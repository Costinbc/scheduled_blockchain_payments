import base64
import time
from pathlib import Path
from typing import Tuple

from multiversx_sdk_core import (
    Address,
    AddressFactory,
    ContractQuery,
    Transaction,
    TransactionComputer,
    TransactionPayload,
)
from multiversx_sdk_network_providers import ProxyNetworkProvider
from multiversx_sdk_wallet import UserPEM, UserSigner

from config import (
    ACCOUNT_ADDRESS,
    CHAIN_ID,
    CONTRACT_ADDRESS,
    GAS_LIMIT,
    PEM_PATH,
    POLL_INTERVAL_SECONDS,
    PROXY_URL,
)

STATUS_ACTIVE = 1


def decode_u64(encoded: str) -> int:
    if not encoded:
        return 0
    raw = base64.b64decode(encoded)
    return int.from_bytes(raw, byteorder="big")


def decode_u8(encoded: str) -> int:
    if not encoded:
        return 0
    raw = base64.b64decode(encoded)
    return int.from_bytes(raw, byteorder="big")


def decode_biguint(encoded: str) -> int:
    if not encoded:
        return 0
    raw = base64.b64decode(encoded)
    return int.from_bytes(raw, byteorder="big")


def arg_to_hex(value: int) -> str:
    if value == 0:
        return "00"
    return value.to_bytes((value.bit_length() + 7) // 8, byteorder="big").hex()


def query_u64(provider: ProxyNetworkProvider, function_name: str, encoded_args) -> int:
    query = ContractQuery(
        contract=Address.from_bech32(CONTRACT_ADDRESS),
        function=function_name,
        encoded_arguments=encoded_args,
    )
    response = provider.query_contract(query)
    return decode_u64(response.return_data[0] if response.return_data else "")


def query_subscription_payment_info(
    provider: ProxyNetworkProvider, sub_id: int
) -> Tuple[int, int, int, int]:
    query = ContractQuery(
        contract=Address.from_bech32(CONTRACT_ADDRESS),
        function="getSubscriptionPaymentInfo",
        encoded_arguments=[arg_to_hex(sub_id)],
    )
    response = provider.query_contract(query)
    data = response.return_data or []
    status = decode_u8(data[0] if len(data) > 0 else "")
    next_block = decode_u64(data[1] if len(data) > 1 else "")
    remaining_balance = decode_biguint(data[2] if len(data) > 2 else "")
    amount_per_cycle = decode_biguint(data[3] if len(data) > 3 else "")
    return status, next_block, remaining_balance, amount_per_cycle


def query_subscription_state(
    provider: ProxyNetworkProvider, sub_id: int
) -> Tuple[int, int, int]:
    query = ContractQuery(
        contract=Address.from_bech32(CONTRACT_ADDRESS),
        function="getSubscriptionState",
        encoded_arguments=[arg_to_hex(sub_id)],
    )
    response = provider.query_contract(query)
    data = response.return_data or []
    status = decode_u8(data[0] if len(data) > 0 else "")
    next_block = decode_u64(data[1] if len(data) > 1 else "")
    cancel_block = decode_u64(data[2] if len(data) > 2 else "")
    return status, next_block, cancel_block


def build_trigger_payment_tx(sender: Address, nonce: int, sub_id: int) -> Transaction:
    payload = f"triggerPayment@{arg_to_hex(sub_id)}"
    return Transaction(
        nonce=nonce,
        sender=sender.to_bech32(),
        receiver=Address.from_bech32(CONTRACT_ADDRESS).to_bech32(),
        gas_limit=GAS_LIMIT,
        chain_id=CHAIN_ID,
        value=0,
        data=TransactionPayload.from_str(payload).data,
    )


def build_finalize_cancellation_tx(
    sender: Address, nonce: int, sub_id: int
) -> Transaction:
    payload = f"finalizeCancellation@{arg_to_hex(sub_id)}"
    return Transaction(
        nonce=nonce,
        sender=sender.to_bech32(),
        receiver=Address.from_bech32(CONTRACT_ADDRESS).to_bech32(),
        gas_limit=GAS_LIMIT,
        chain_id=CHAIN_ID,
        value=0,
        data=TransactionPayload.from_str(payload).data,
    )


def get_current_block(provider: ProxyNetworkProvider) -> int:
    status = provider.get_network_status()
    return int(status.current_round)


def main() -> None:
    provider = ProxyNetworkProvider(PROXY_URL)
    signer = UserSigner.from_pem_file(Path(PEM_PATH))

    if ACCOUNT_ADDRESS:
        sender_address = Address.from_bech32(ACCOUNT_ADDRESS)
    else:
        sender_pem = UserPEM.from_file(Path(PEM_PATH))
        sender_address = AddressFactory().create_from_public_key(
            sender_pem.public_key.buffer
        )

    while True:
        try:
            last_id = query_u64(provider, "getLastSubscriptionId", [])
            if last_id == 0:
                time.sleep(POLL_INTERVAL_SECONDS)
                continue

            current_block = get_current_block(provider)
            account = provider.get_account(sender_address)
            nonce = account.nonce

            tx_computer = TransactionComputer()
            for sub_id in range(1, last_id + 1):
                status, next_block, cancel_block = query_subscription_state(
                    provider, sub_id
                )
                if status == STATUS_ACTIVE:
                    if current_block < next_block:
                        continue
                    tx = build_trigger_payment_tx(sender_address, nonce, sub_id)
                    data_to_sign = tx_computer.compute_bytes_for_signing(tx)
                    tx.signature = signer.sign(data_to_sign)
                    provider.send_transaction(tx)
                    nonce += 1
                elif status in (2, 3) and current_block >= cancel_block:
                    tx = build_finalize_cancellation_tx(
                        sender_address, nonce, sub_id
                    )
                    data_to_sign = tx_computer.compute_bytes_for_signing(tx)
                    tx.signature = signer.sign(data_to_sign)
                    provider.send_transaction(tx)
                    nonce += 1

        except Exception as err:
            print(f"Scheduler error: {err}")

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
