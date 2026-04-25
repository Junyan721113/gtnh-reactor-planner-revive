import { memo } from "react";
import { useInfoBarMessage } from "../state/infoBarStore";

export const InfoBar = memo(function InfoBar() {
  const message = useInfoBarMessage();

  return (
    <div className="info-bar" role="status" aria-live="polite">
      <p className="info-bar-label">信息栏</p>
      <p className="info-bar-title">{message.title}</p>
      <p className="info-bar-detail">{message.detail}</p>
    </div>
  );
});

InfoBar.displayName = "InfoBar";
