import { Duration } from '@sqsbench/helpers';
import { BacklogMonitor } from './BacklogMonitor.mjs'

describe('BacklogMonitor', () => {
  let sut: BacklogMonitor<number>

  beforeEach(() => {
    sut = new BacklogMonitor()
  })

  it('should terminate on initial empty batch', async () => {
    // Arrange
    async function* source() {
      yield { data: [], acquiredIn: Duration.seconds(0) };
    }

    const complete = jest.fn();
    sut.consume(source()).then(complete);
    // Act
    const result = [];
    for await (const batch of sut) {
      result.push(batch);
    }
    // Assert
    expect(result).toHaveLength(0);
    expect(complete).toHaveBeenCalled();
  })

  it('should terminate on subsequent empty batch', async () => {
    // Arrange
    async function* source() {
      yield { data: [1, 2, 3], acquiredIn: Duration.seconds(0) }
      yield { data: [], acquiredIn: Duration.seconds(0) }
      yield { data: [4, 5, 6], acquiredIn: Duration.seconds(0) }
    }

    const complete = jest.fn();
    sut.consume(source()).then(complete);

    // Act
    const result = [];
    for await (const batch of sut) {
      result.push(batch);
    }

    // Assert
    expect(result).toEqual([
      { data: [1, 2, 3], acquiredIn: Duration.seconds(0) },
    ])
    expect(complete).toHaveBeenCalled();
  })

})