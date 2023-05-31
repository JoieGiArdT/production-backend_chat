import { Application } from 'express'
import { readdirSync } from 'fs'

export default class Routes {
  PATH_ROUTER = `${__dirname}`
  constructor (app: Application) {
    this.intializeRoutes(app)
  }

  intializeRoutes (app: Application): void {
    readdirSync(this.PATH_ROUTER).forEach((fileName) => {
      const route = String(this.getRouteName(fileName))
      if (route !== 'index') {
        import(`./${route}.routes`).then((moduleRouter) => {
          app.use(`/${route}`, moduleRouter.router)
        }).catch((error) => console.error(error))
      }
    })
  }

  getRouteName (fileName: String): string {
    return String(fileName.split('.').shift())
  }
}
