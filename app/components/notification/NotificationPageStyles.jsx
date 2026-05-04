const NOTIFICATION_PAGE_STYLES = `
.notification-page,
.notification-page p,
.notification-page span,
.notification-page label,
.notification-page input,
.notification-page textarea,
.notification-page select,
.notification-page button,
.notification-page .Polaris-Text,
.notification-page .Polaris-Button {
  font-size: 12px;
  line-height: 1.35 !important;
}
.notification-page h1,
.notification-page h2,
.notification-page h3,
.notification-page h4,
.notification-page .Polaris-Text--headingXs,
.notification-page .Polaris-Text--headingSm,
.notification-page .Polaris-Text--headingMd,
.notification-page .Polaris-Text--headingLg,
.notification-page .Polaris-Text--headingXl {
  font-size: 16px !important;
  line-height: 1.25 !important;
  font-weight: 700 !important;
}
.notification-page .Polaris-Button {
  min-height: 30px;
}
.notification-page input:focus,
.notification-page textarea:focus,
.notification-page select:focus {
  width: unset !important;
}
.notification-page .Polaris-Card {
  border-radius: 8px;
}
`;

export function NotificationPageStyles() {
  return <style>{NOTIFICATION_PAGE_STYLES}</style>;
}
