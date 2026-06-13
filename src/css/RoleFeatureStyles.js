export const VIP_BADGE_STYLE_ID = 'blobio-vip-role-style';
export const CHAT_ROLE_STYLE_ID = 'blobio-chat-role-style';

export const VIP_BADGE_CSS = `
.blobio-vip-plus-slot {
  position: fixed !important;
  left: var(--blobio-vip-plus-left, -9999px) !important;
  top: var(--blobio-vip-plus-top, -9999px) !important;
  z-index: 4 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: max-content !important;
  height: max-content !important;
  margin: 0 !important;
  line-height: 0 !important;
  transform: translateY(-50%) !important;
  pointer-events: none !important;
  isolation: isolate;
}

.blobio-vip-plus-icon {
  display: block !important;
  width: auto !important;
  height: var(--blobio-vip-plus-size, 188px) !important;
  max-width: 320px !important;
  margin: 0 !important;
  object-fit: contain !important;
  transform: scale(1) !important;
  transform-origin: center;
  transition: transform 170ms ease, filter 170ms ease !important;
  filter: drop-shadow(0 0 10px rgba(255, 196, 55, 0.34));
  cursor: pointer;
  pointer-events: auto !important;
}

.blobio-vip-plus-icon:hover {
  transform: scale(1.06) !important;
  filter: drop-shadow(0 0 15px rgba(255, 204, 72, 0.52));
}

.blobio-vip-plus-time {
  position: absolute;
  left: 50%;
  top: 50%;
  max-width: 88%;
  transform: translate(-50%, -50%);
  color: #f4fff6;
  font-size: clamp(11px, calc(var(--blobio-vip-plus-size, 188px) * 0.09), 25px);
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0.02em;
  text-align: center;
  white-space: nowrap;
  text-shadow: 0 0 5px rgba(255, 255, 255, 0.9), 0 0 11px rgba(87, 255, 134, 0.88), 0 0 20px rgba(52, 255, 112, 0.55);
  pointer-events: none;
}

.blobio-vip-plus-time.is-unlimited {
  color: #fff7cf;
  text-shadow: 0 0 5px rgba(255, 255, 255, 0.95), 0 0 11px rgba(255, 211, 73, 0.92), 0 0 23px rgba(255, 174, 30, 0.7);
  animation: blobio-vip-unlimited-pulse 2400ms ease-in-out infinite;
}

@keyframes blobio-vip-unlimited-pulse {
  0%, 100% { opacity: 0.82; transform: translate(-50%, -50%) scale(0.97); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.04); }
}

@media (prefers-reduced-motion: reduce) {
  .blobio-vip-plus-icon,
  .blobio-vip-plus-time.is-unlimited {
    transition: none !important;
    animation: none !important;
  }
}
`;

export const CHAT_ROLE_CSS = `
#chat .blobio-extension-chat-tag {
  font-weight: 800 !important;
}

#chat .blobio-chat-vip-plus-tag {
  color: #ffd34f !important;
  text-decoration: underline !important;
  text-decoration-color: #ffd34f !important;
  text-underline-offset: 2px;
  text-shadow: 0 0 6px rgba(255, 248, 204, 0.74), 0 0 11px rgba(255, 190, 47, 0.72);
}

#chat .blobio-chat-vip-plus-tag.is-admin-combined {
  text-decoration: none !important;
}

#chat .blobio-chat-admin-tag {
  color: rgb(0, 255, 0) !important;
  text-decoration: underline !important;
  text-underline-offset: 2px;
  text-shadow: 0 0 7px rgba(0, 255, 0, 0.72);
}

#chat .blobio-chat-admin-username {
  font-weight: 800 !important;
  text-decoration: underline !important;
  text-underline-offset: 2px;
}

#chat .blobio-chat-admin-message {
  color: rgb(0, 161, 0) !important;
  font-weight: 800 !important;
  text-decoration: underline !important;
  text-underline-offset: 2px;
}

#chat .blobio-chat-built-in-vip-hidden {
  display: none !important;
}
`;
