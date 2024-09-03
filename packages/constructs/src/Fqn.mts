import { Construct } from "constructs"
import crypto from "crypto-js"

export interface FqnOptions {
  separator?: string
  hashSeparator?: string
  allowedSpecialCharacters?: string
  suffix?: string | string[]
  transform?: (name: string) => string
  maxLength?: number
}

/**
 * Generate a unique name based on the path of a construct
 *
 * @param construct The construct to name
 * @param suffix A string or array of strings to append to the path
 * @param separator The character to use to separate path parts (can be empty string)
 * @param hashSeparator The character to use to separate the name from the hash (can be empty string)
 * @param allowedSpecialCharacters Allows a-z, A-Z, 0-9 by default, plus any additional characters specified here
 * @param transform A function to apply to the name before returning
 * @param maxLength The maximum length of the name, including the hash
 * @constructor
 */
export function Fqn(construct: Construct, { suffix, separator, hashSeparator, allowedSpecialCharacters, transform, maxLength }: FqnOptions = {}): string {

  const parts = construct.node.path.split('/')

  if (Array.isArray(suffix)) {
    parts.push(...suffix)
  } else if (typeof suffix === 'string') {
    parts.push(suffix)
  }

  // hashName is based no the full path, including suffixes
  const hashName = parts.join(separator ?? '')

  // name is based on the full path, excluding 'Default'
  let name = parts.filter(part => part !== 'Default').join(separator ?? '')

  // sanitize the name
  const escapedSpecialChars = allowedSpecialCharacters?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') ?? ''
  name = name.match(new RegExp(`[a-zA-Z0-9${escapedSpecialChars}]`, 'g'))?.join('') ?? ''

  // validate the result
  if (name.length < 1) {
    throw new Error('Fqn: name must contain at least one alphanumeric character')
  }

  if (maxLength !== undefined) {
    const length = Math.max(0, maxLength - (8 + (hashSeparator?.length ?? 0) + 1))
    if (length < name.length) {
      name = name.slice(0, length)
    }
  }

  // append the hash
  name = [name, crypto.MD5(hashName).toString(crypto.enc.Hex).slice(0,8)].join(hashSeparator ?? '-')

  // apply transformation
  name = transform?.(name) ?? name

  // console.log(construct.node.path, name)

  return name
}