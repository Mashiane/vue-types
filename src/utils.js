import isPlainObject from 'is-plain-object'
import Vue from 'vue'

const ObjProto = Object.prototype
const toString = ObjProto.toString
export const hasOwn = ObjProto.hasOwnProperty

const FN_MATCH_REGEXP = /^\s*function (\w+)/

// https://github.com/vuejs/vue/blob/dev/src/core/util/props.js#L177
export function getType(fn) {
  const type = fn !== null && fn !== undefined ? (fn.type ? fn.type : fn) : null
  const match = type && type.toString().match(FN_MATCH_REGEXP)
  return match && match[1]
}

export function getNativeType(value) {
  if (value === null || value === undefined) return null
  const match = value.constructor.toString().match(FN_MATCH_REGEXP)
  return match && match[1]
}

/**
 * No-op function
 */
export function noop() {}

/**
 * A function that returns its first argument
 *
 * @param {*} arg
 * @returns {*}
 */
export const identity = (arg) => arg

/**
 * A function that always returns true
 */
export const stubTrue = () => true

/**
 * Checks for a own property in an object
 *
 * @param {object} obj - Object
 * @param {string} prop - Property to check
 * @returns {boolean}
 */
export const has = (obj, prop) => hasOwn.call(obj, prop)

/**
 * Determines whether the passed value is an integer. Uses `Number.isInteger` if available
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isInteger
 * @param {*} value - The value to be tested for being an integer.
 * @returns {boolean}
 */
export const isInteger =
  Number.isInteger ||
  function isInteger(value) {
    return (
      typeof value === 'number' &&
      isFinite(value) &&
      Math.floor(value) === value
    )
  }

/**
 * Determines whether the passed value is an Array.
 *
 * @param {*} value - The value to be tested for being an array.
 * @returns {boolean}
 */
export const isArray =
  Array.isArray ||
  function isArray(value) {
    return toString.call(value) === '[object Array]'
  }

/**
 * Checks if a value is a function
 *
 * @param {any} value - Value to check
 * @returns {boolean}
 */
export const isFunction = (value) =>
  toString.call(value) === '[object Function]'

/**
 * Adds a `def` method to the object returning a new object with passed in argument as `default` property
 *
 * @param {object} type - Object to enhance
 * @returns {object} the passed-in prop type
 */
export function withDefault(type) {
  return Object.defineProperty(type, 'def', {
    value(def) {
      if (def === undefined && !this.default) {
        return this
      }
      if (!isFunction(def) && !validateType(this, def)) {
        warn(`${this._vueTypes_name} - invalid default value: "${def}"`, def)
        return this
      }
      if (isArray(def)) {
        this.default = () => [...def]
      } else if (isPlainObject(def)) {
        this.default = () => Object.assign({}, def)
      } else {
        this.default = def
      }
      return this
    },
    enumerable: false,
    writable: false,
  })
}

/**
 * Adds a `isRequired` getter returning a new object with `required: true` key-value
 *
 * @param {object} type - Object to enhance
 * @returns {object} the passed-in prop type
 */
export function withRequired(type) {
  return Object.defineProperty(type, 'isRequired', {
    get() {
      this.required = true
      return this
    },
    enumerable: false,
  })
}

/**
 * Adds a validate method useful to set the prop `validator` function.
 *
 * @param {object} type Prop type to extend
 * @returns {object} the passed-in prop type
 */
export function withValidate(type) {
  return Object.defineProperty(type, 'validate', {
    value(fn) {
      this.validator = fn.bind(this)
      return this
    },
    enumerable: false,
  })
}

/**
 * Adds `isRequired` and `def` modifiers to an object
 *
 * @param {string} name - Type internal name
 * @param {object} obj - Object to enhance
 * @param {boolean} [validateFn=false] - add the `validate()` method to the type object
 * @returns {object}
 */
export function toType(name, obj, validateFn = false) {
  Object.defineProperty(obj, '_vueTypes_name', {
    enumerable: false,
    writable: false,
    value: name,
  })

  withDefault(withRequired(obj))

  if (validateFn) {
    withValidate(obj)
  } else {
    Object.defineProperty(obj, 'validate', {
      value() {
        warn(`${name} - "validate" method not supported on this type`)
        return this
      },
      enumerable: false,
    })
  }

  if (isFunction(obj.validator)) {
    obj.validator = obj.validator.bind(obj)
  }
  return obj
}

/**
 * Validates a given value against a prop type object
 *
 * @param {Object|*} type - Type to use for validation. Either a type object or a constructor
 * @param {*} value - Value to check
 * @param {boolean} silent - Silence warnings
 * @returns {boolean}
 */
export function validateType(type, value, silent = false) {
  let typeToCheck = type
  let valid = true
  let expectedType
  if (!isPlainObject(type)) {
    typeToCheck = { type }
  }
  const namePrefix = typeToCheck._vueTypes_name
    ? typeToCheck._vueTypes_name + ' - '
    : ''

  if (hasOwn.call(typeToCheck, 'type') && typeToCheck.type !== null) {
    if (typeToCheck.type === undefined) {
      throw new TypeError(
        `[VueTypes error]: Setting type to undefined is not allowed.`,
      )
    }
    if (!typeToCheck.required && value === undefined) {
      return valid
    }
    if (isArray(typeToCheck.type)) {
      valid = typeToCheck.type.some(
        (type) => validateType(type, value, true) === true,
      )
      expectedType = typeToCheck.type.map((type) => getType(type)).join(' or ')
    } else {
      expectedType = getType(typeToCheck)

      if (expectedType === 'Array') {
        valid = isArray(value)
      } else if (expectedType === 'Object') {
        valid = isPlainObject(value)
      } else if (
        expectedType === 'String' ||
        expectedType === 'Number' ||
        expectedType === 'Boolean' ||
        expectedType === 'Function'
      ) {
        valid = getNativeType(value) === expectedType
      } else {
        valid = value instanceof typeToCheck.type
      }
    }
  }

  if (!valid) {
    const msg = `${namePrefix}value "${value}" should be of type "${expectedType}"`
    if (silent === false) {
      warn(msg)
      return valid
    }
    return msg
  }

  if (
    hasOwn.call(typeToCheck, 'validator') &&
    isFunction(typeToCheck.validator)
  ) {
    const oldWarn = warn
    const warnLog = []
    warn = (msg) => {
      warnLog.push(msg)
    }

    valid = typeToCheck.validator(value)
    warn = oldWarn

    if (!valid) {
      const msg = warnLog.length > 0 ? '* ' + warnLog.join('\n * ') : ''
      warnLog.length = 0
      if (silent === false) {
        msg && warn(msg)
        return valid
      }
      return msg
    }
  }
  return valid
}

let warn = identity

if (process.env.NODE_ENV !== 'production') {
  const hasConsole = typeof console !== 'undefined'
  warn = hasConsole
    ? function warn(msg) {
        // eslint-disable-next-line no-console
        Vue.config.silent === false && console.warn(`[VueTypes warn]: ${msg}`)
      }
    : identity
}

export { warn }
