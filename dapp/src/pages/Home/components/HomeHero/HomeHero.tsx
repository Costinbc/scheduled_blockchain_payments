import classNames from 'classnames';
import { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'components/Button';
import { RouteNamesEnum } from 'localConstants';
import styles from './homeHero.styles';

export const HomeHero = () => {
  const navigate = useNavigate();

  const handleLogIn = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    navigate(RouteNamesEnum.unlock);
  };

  const heroContainerClasses = classNames(styles.heroContainer);

  return (
    <div className={heroContainerClasses}>
      <div className={styles.heroSectionTop}>
        <div className={styles.heroSectionTopContent}>
          <h1 className={styles.heroTitle}>Subscription Platform</h1>

          <p className={styles.heroDescription}>
            Register, manage services, and handle scheduled subscription payments.
          </p>
        </div>

        <div className={styles.heroSectionTopButtons}>
          <Button onClick={handleLogIn}>Connect Wallet</Button>
        </div>
      </div>
    </div>
  );
};
