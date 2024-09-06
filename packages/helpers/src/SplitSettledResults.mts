export function splitSettledResults<T>(results: PromiseSettledResult<T>[]) {
  return results.reduce((acc, result) => {
    return {
      fulfilled: acc.fulfilled.concat(result.status === 'fulfilled' ? result.value : []),
      rejected: acc.rejected.concat(result.status === 'rejected' ? result.reason : []),
    }
  }, { fulfilled: [] as T[], rejected: [] as Error[] })
}