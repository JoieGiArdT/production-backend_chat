import { Router, Application } from 'express'
// import { readdirSync } from 'fs'
import WhatsappController from '../controllers/whatsapp.controller'

export default class Routes {
  PATH_ROUTER = `${__dirname}`
  router = Router()
  whatsappController = new WhatsappController()
  constructor (app: Application) {
    this.intializeRoutes(app)
  }

  intializeRoutes (app: Application): void {
    app.get('/whatsapp', this.whatsappController.verifyToken)
    app.post('/whatsapp', this.whatsappController.receivedMessageWhatsapp)
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
