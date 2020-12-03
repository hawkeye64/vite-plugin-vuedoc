// import fs from 'fs-extra'
import { VUEDOC_PREFIX } from './resolver'
import { VueDocPluginOptions } from '.'
import path from 'path'
import { remarkFile } from './remark'

const slash = require('slash')
const debug = require('debug')('vite:vuedoc:md')

export type DemoType = {
  id: string
  code: string
}

export function createMarkdownRenderFn(options: VueDocPluginOptions, isBuild = false) {
  const { wrapperClass, previewClass, markdownPlugins } = options
  return async (file: string, publicPath: string) => {
    const start = Date.now()
    const { template, vueBlocks: demos, matter: matterData } = await remarkFile(file, {
      vuePrefix: VUEDOC_PREFIX,
      previewClass,
      plugins: markdownPlugins
    })

    const docComponent = `
    <template>
      <div class="vuedoc ${wrapperClass || ''} ${matterData.wrapperClass || ''}">
        ${template}
      </div>
    </template>
    <script>
    import { defineComponent, reactive, ref, toRefs, onMounted } from 'vue';
    ${demos
      .map(demo => {
        const request = `${slash(publicPath)}/${demo.id}`
        debug(`file:${publicPath} request:${request}`)
        return `import ${demo.id} from '${request}${isBuild ? '.vue' : ''}';`
      })
      .join('\n')}

    const script = defineComponent({
      components: {
        ${demos.map(demo => demo.id).join(',')}
      },
      setup(props) {
        ${demos.map(demo => `const ${demo.id}Ref = ref()`).join('\n')}
        const refs = [${demos.map(demo => `${demo.id}Ref`).join(',')}]
        const state = reactive({
          ${demos.map(demo => `${demo.id}Height: '0px'`).join(',')}
        })

        const toggleCode = (index) => {
          const id = '${VUEDOC_PREFIX}' + index
          if (state[id+'Height'] === '0px') {
            state[id+'Height'] = ((refs[index].value ? refs[index].value.offsetHeight : 0) || 0) + 'px'
          } else {
            state[id+'Height'] = 0 + 'px'
          }
        }

        return {
          toggleCode,
          ...toRefs(state),
          ${demos.map(demo => `${demo.id}Ref`).join(',')}
        }
      }
    });
    script.matter = ${JSON.stringify(matterData)}
    export default script;
    
    ${isBuild ? '' : 'if (import.meta.hot) { import.meta.hot.accept(); }'}
    
    </script>
    `

    debug(`[render] ${path} in ${Date.now() - start}ms.`)

    const result = { component: docComponent, demos: [...demos] }
    return result
  }
}
