import { createApp, defineComponent, h } from 'vue'
import VueTypes, { toType, arrayOf, shape } from 'vue-types'

interface UserData {
  name: string
  age: number
}

class CustomTypes extends VueTypes {
  static get adult() {
    return toType('adult', {
      type: Number,
      validator(v) {
        return v >= 18
      },
    })
  }
}

const User = defineComponent({
  setup(props) {
    return () => h('li', [h('strong', [props.name]), props.age])
  },
  props: {
    name: CustomTypes.string.isRequired,
    age: CustomTypes.adult,
  },
})

const UserList = defineComponent({
  setup(props) {
    return () =>
      h(
        'ul',
        props.users.map((user) => h(User, { ...user, key: user.name })),
      )
  },
  props: {
    users: arrayOf(shape<UserData>(User.props)).isRequired,
  },
})

createApp({
  setup() {
    const users: UserData[] = [
      {
        name: 'John',
        age: 20,
      },
      {
        name: 'Jane',
        age: 30,
      },
      {
        name: 'Jack',
        age: 18,
      },
    ]
    return () =>
      h('section', [h('h1', ['A list of users']), h(UserList, { users })])
  },
}).mount('#app')
