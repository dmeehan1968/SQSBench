export function getCurrentTime(): Date {
  // Start at the top of the next minute
  const currentTime = new Date()
  currentTime.setMinutes(currentTime.getMinutes() + 1, 0, 0)
  return currentTime
}