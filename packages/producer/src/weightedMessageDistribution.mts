export function weightedMessageDistribution(
  messageCount: number,
  duration: number,
  weights: number[] = [1],
): number[] {

  if (messageCount <= 0 || !Number.isInteger(messageCount)) {
    throw new Error('Message count must be an integer greater than 0')
  }

  if (duration <= 0 || !Number.isInteger(duration)) {
    throw new Error('Duration must be an integer greater than 0')
  }

  if (weights.length === 0) {
    throw new Error('At least one weight must be provided')
  }

  weights.forEach(weight => {
    if (weight < 0) {
      throw new Error('Weights must be non-negative')
    }
  })

  // Calculate the total weight
  let totalWeight = weights.reduce((acc, weight) => acc + weight, 0)
  if (totalWeight === 0) {
    throw new Error('Total weight must be greater than 0')
  }

  // Calculate segment duration
  const segmentDuration = duration / weights.length

  // Initial allocation (using floor)
  const messagesPerSegment = weights.map(weight => Math.floor((messageCount * weight) / totalWeight))

  // Calculate the total allocated messages so far
  let totalAllocated = messagesPerSegment.reduce((acc, count) => acc + count, 0)

  // Calculate how many more messages we need to distribute
  let remaining = messageCount - totalAllocated

  // Calculate fractional parts to determine where to add remaining messages
  const fractions = weights.map(weight => ((messageCount * weight) / totalWeight) % 1)

  // Distribute the remaining messages to the segments with the largest fractional parts
  while (remaining > 0) {
    const maxIndex = fractions.indexOf(Math.max(...fractions))
    messagesPerSegment[maxIndex]++
    fractions[maxIndex] = Number.NEGATIVE_INFINITY // Mark this index as used
    remaining--
  }

  // Generate timestamps for each message in each segment
  return messagesPerSegment.flatMap((segmentLimit, index) =>
    Array.from({ length: segmentLimit }, () =>
      Math.floor(Math.random() * segmentDuration + index * segmentDuration),
    ),
  ).sort((a, b) => a - b)
}