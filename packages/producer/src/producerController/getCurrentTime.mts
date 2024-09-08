export function getCurrentTime(): Date {
  // Start at the top of the next minute
  const currentTime = new Date()
  currentTime.setSeconds(0, 0)
  currentTime.setMinutes(currentTime.getMinutes() + 1)
  return currentTime
}