import { defineComponent, h, computed, ref, createApp } from 'vue'
import { shape, string, bool } from 'vue-types'

interface Data {
  id: string
  isNew: boolean
}

const Model = defineComponent({
  setup(props) {
    const isNew = computed(() => (props.model.isNew ? '- new' : ''))
    return () => h('li', [`${props.model.id} ${isNew.value}`])
  },
  props: {
    model: shape<Data>({
      id: string().isRequired,
      isNew: bool(),
    }).isRequired,
  },
})

const ModelButton = defineComponent({
  setup(props, { slots, attrs }) {
    return () =>
      h('button', { type: 'button', ...props, ...attrs }, slots.default())
  },
})

const App = defineComponent({
  setup() {
    const models = ref<Data[]>([])

    function addModel() {
      models.value.forEach((model: any) => {
        model.isNew = false
      })
      models.value.push({
        id: 'model-' + models.value.length,
        isNew: true,
      })
    }
    return () => {
      return h('section', [
        h('h1', ['A list of models']),
        h(ModelButton, { onClick: addModel }, ['Add model']),
        h(
          'ul',
          models.value.map((model) => h(Model, { model, key: model.id })),
        ),
      ])
    }
  },
})

createApp(App).mount('#app')
