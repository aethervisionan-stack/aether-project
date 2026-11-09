/** Hands-free OS agent client surface (mock bridges + confirm loop). */

export {
  CONFIRM_PHRASES,
  ConfirmationLoop,
  isConfirmationUtterance,
  isRejectionUtterance,
  REJECT_PHRASES,
} from "./ConfirmationLoop";
export { getMockOsBridge, MockOsBridge } from "./MockBridge";
export {
  mapPriorityLevel,
  NotificationListenerSimulator,
  shouldInterruptAudio,
} from "./NotificationListener";
export { playSuccessBeep } from "./SuccessBeep";
