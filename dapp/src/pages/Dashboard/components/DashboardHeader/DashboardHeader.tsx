// prettier-ignore
const styles = {
  dashboardHeaderContainer: 'dashboard-header-container flex flex-col p-8 lg:p-10 justify-center items-center gap-6 self-stretch',
  dashboardHeaderTitle: 'dashboard-header-title text-primary transition-all duration-300 text-center text-3xl xs:text-5xl lg:text-6xl font-medium',
  dashboardHeaderDescription: 'dashboard-header-description text-secondary transition-all duration-300 text-center text-lg xs:text-xl lg:text-2xl font-medium',
  dashboardHeaderDescriptionText: 'dashboard-header-description-text mx-1'
} satisfies Record<string, string>;

export const DashboardHeader = () => (
  <div className={styles.dashboardHeaderContainer}>
    <div className={styles.dashboardHeaderTitle}>Chainvolut</div>

    <div className={styles.dashboardHeaderDescription}>Subscription based Scheduled Payments Platform</div>
    <div className={styles.dashboardHeaderDescription}>
      Subscribe to your favorite services and pay using Egld inside MultiversX
    </div>
  </div>
);
