import { Router, Application } from 'express'
// import { readdirSync } from 'fs'
import { receivedMessageWhatsapp, verifyToken } from '../controllers/whatsapp.controller'

export default class Routes {
  router = Router()
  constructor (app: Application) {
    this.intializeRoutes(app)
  }

  intializeRoutes (app: Application): void {
    app.post('/whatsapp', receivedMessageWhatsapp)
    app.get('/whatsapp', verifyToken)
    /* readdirSync(this.PATH_ROUTER).forEach((fileName) => {
      const route = String(this.getRouteName(fileName))
      if (route !== 'index') {
        import(`./${route}.routes`).then((moduleRouter) => {
          app.use(`/${route}`, moduleRouter.router)
        }).catch((error) => console.error(error))
      }
    }) */
  }

  getRouteName (fileName: String): string {
    return String(fileName.split('.').shift())
  }
}
