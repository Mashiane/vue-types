import isPlainObject from 'is-plain-object'
import {
  toType,
  getType,
  isFunction,
  validateType,
  isInteger,
  isArray,
  warn,
  has,
  stubTrue,
} from './utils'
import { setDefaults } from './sensibles'

const VueTypes = {
  get any() {
    return toType(
      'any',
      {
        type: null,
      },
      true,
    )
  },

  get func() {
    return toType(
      'function',
      {
        type: Function,
      },
      true,
    ).def(VueTypes.sensibleDefaults.func)
  },

  get bool() {
    return toType(
      'boolean',
      {
        type: Boolean,
      },
      true,
    ).def(VueTypes.sensibleDefaults.bool)
  },

  get string() {
    return toType(
      'string',
      {
        type: String,
      },
      true,
    ).def(VueTypes.sensibleDefaults.string)
  },

  get number() {
    return toType(
      'number',
      {
        type: Number,
      },
      true,
    ).def(VueTypes.sensibleDefaults.number)
  },

  get array() {
    return toType(
      'array',
      {
        type: Array,
      },
      true,
    ).def(VueTypes.sensibleDefaults.array)
  },

  get object() {
    return toType(
      'object',
      {
        type: Object,
      },
      true,
    ).def(VueTypes.sensibleDefaults.object)
  },

  get integer() {
    return toType('integer', {
      type: Number,
      validator(value) {
        return isInteger(value)
      },
    }).def(VueTypes.sensibleDefaults.integer)
  },

  get symbol() {
    return toType(
      'symbol',
      {
        type: null,
        validator(value) {
          return typeof value === 'symbol'
        },
      },
      true,
    )
  },

  extend(props = {}) {
    if (isArray(props)) {
      props.forEach((p) => VueTypes.extend(p))
      return this
    }

    let { name, validate = false, getter = false, ...opts } = props

    if (has(VueTypes, name)) {
      throw new TypeError(`[VueTypes error]: Type "${name}" already defined`)
    }

    const { type, validator = stubTrue } = opts
    if (type && type._vueTypes_name) {
      // we are using as base type a vue-type object

      // detach the original type
      // we are going to inherit the parent data.
      delete opts.type

      // inherit base types, required flag and default flag if set
      const keys = ['type', 'required', 'default']
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i]
        if (type[key] !== undefined) {
          opts[key] = type[key]
        }
      }

      validate = false // we don't allow validate method on this kind of types
      if (isFunction(type.validator)) {
        opts.validator = function(...args) {
          return type.validator.apply(type, args) && validator.apply(this, args)
        }
      }
    }
    let descriptor
    if (getter) {
      descriptor = {
        get() {
          return toType(name, Object.assign({}, opts), validate)
        },
        enumerable: true,
        configurable: false,
      }
    } else {
      const { validator } = opts
      descriptor = {
        value(...args) {
          const ret = toType(name, Object.assign({}, opts), validate)
          if (validator) {
            ret.validator = validator.bind(ret, ...args)
          }
          return ret
        },
        writable: false,
        enumerable: true,
        configurable: false,
      }
    }

    return Object.defineProperty(this, name, descriptor)
  },

  custom(validatorFn, warnMsg = 'custom validation failed') {
    if (typeof validatorFn !== 'function') {
      throw new TypeError(
        '[VueTypes error]: You must provide a function as argument',
      )
    }

    return toType(validatorFn.name || '<<anonymous function>>', {
      validator(value) {
        const valid = validatorFn(value)
        if (!valid) warn(`${this._vueTypes_name} - ${warnMsg}`)
        return valid
      },
    })
  },

  oneOf(arr) {
    if (!isArray(arr)) {
      throw new TypeError(
        '[VueTypes error]: You must provide an array as argument',
      )
    }
    const msg = `oneOf - value should be one of "${arr.join('", "')}"`
    const allowedTypes = arr.reduce((ret, v) => {
      if (v !== null && v !== undefined) {
        ret.indexOf(v.constructor) === -1 && ret.push(v.constructor)
      }
      return ret
    }, [])

    return toType('oneOf', {
      type: allowedTypes.length > 0 ? allowedTypes : null,
      validator(value) {
        const valid = arr.indexOf(value) !== -1
        if (!valid) warn(msg)
        return valid
      },
    })
  },

  instanceOf(instanceConstructor) {
    return toType('instanceOf', {
      type: instanceConstructor,
    })
  },

  oneOfType(arr) {
    if (!isArray(arr)) {
      throw new TypeError(
        '[VueTypes error]: You must provide an array as argument',
      )
    }

    let hasCustomValidators = false

    let nativeChecks = arr.reduce((ret, type) => {
      if (isPlainObject(type)) {
        if (type._vueTypes_name === 'oneOf') {
          return ret.concat(type.type || [])
        }
        if (isFunction(type.validator)) {
          hasCustomValidators = true
        }
        if (typeof type.type !== 'undefined') {
          if (isArray(type.type)) return ret.concat(type.type)
          ret.push(type.type)
        }
        return ret
      }
      ret.push(type)
      return ret
    }, [])

    // remove duplicates
    nativeChecks = nativeChecks.filter((t, i) => nativeChecks.indexOf(t) === i)

    if (!hasCustomValidators) {
      // we got just native objects (ie: Array, Object)
      // delegate to Vue native prop check
      return toType('oneOfType', {
        type: nativeChecks,
      })
    }

    return toType('oneOfType', {
      type: nativeChecks,
      validator(value) {
        const valid = arr.some((type) => {
          const t = type._vueTypes_name === 'oneOf' ? type.type || null : type
          return validateType(t, value, true) === true
        })
        if (!valid)
          warn(
            `oneOfType - value "${value}" does not match any of the passed-in validators.`,
          )
        return valid
      },
    })
  },

  arrayOf(type) {
    return toType('arrayOf', {
      type: Array,
      validator(values) {
        const valid = values.every((value) => validateType(type, value))
        if (!valid)
          warn(`arrayOf - value must be an array of "${getType(type)}"`)
        return valid
      },
    })
  },

  objectOf(type) {
    return toType('objectOf', {
      type: Object,
      validator(obj) {
        const valid = Object.keys(obj).every((key) =>
          validateType(type, obj[key]),
        )
        if (!valid)
          warn(`objectOf - value must be an object of "${getType(type)}"`)
        return valid
      },
    })
  },

  shape(obj) {
    const keys = Object.keys(obj)
    const requiredKeys = keys.filter(
      (key) => obj[key] && obj[key].required === true,
    )

    const type = toType('shape', {
      type: Object,
      validator(value) {
        if (!isPlainObject(value)) {
          return false
        }
        const valueKeys = Object.keys(value)

        // check for required keys (if any)
        if (
          requiredKeys.length > 0 &&
          requiredKeys.some((req) => valueKeys.indexOf(req) === -1)
        ) {
          const missing = requiredKeys.filter(
            (req) => valueKeys.indexOf(req) === -1,
          )
          if (missing.length === 1) {
            warn(`shape - required property "${missing[0]}" is not defined.`)
          } else {
            warn(
              `shape - required properties "${missing.join(
                '", "',
              )}" are not defined.`,
            )
          }
          return false
        }

        return valueKeys.every((key) => {
          if (keys.indexOf(key) === -1) {
            if (this._vueTypes_isLoose === true) return true
            warn(
              `shape - shape definition does not include a "${key}" property. Allowed keys: "${keys.join(
                '", "',
              )}".`,
            )
            return false
          }
          const type = obj[key]

          const valid = validateType(type, value[key], true)
          if (typeof valid === 'string') {
            warn(`shape - "${key}" property validation error:\n * ${valid}`)
          }
          return valid === true
        })
      },
    })

    Object.defineProperty(type, '_vueTypes_isLoose', {
      enumerable: false,
      writable: true,
      value: false,
    })

    Object.defineProperty(type, 'loose', {
      get() {
        this._vueTypes_isLoose = true
        return this
      },
      enumerable: false,
    })

    return type
  },
}

setDefaults(VueTypes)

VueTypes.utils = {
  validate(value, type) {
    return validateType(type, value, true) === true
  },
  toType,
}

export default VueTypes
