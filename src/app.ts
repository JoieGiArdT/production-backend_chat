import Routes from './routes/index.routes'
import cors from 'cors'
// import * as dialogflow from "@google-cloud/dialogflow";
import { Application, urlencoded, json } from 'express'
/* import * as morgan from 'morgan';
import * as fs from 'fs';
import { WriteStream } from 'fs';
import * as path from 'path'; */
import * as winston from 'winston'

// app.enable('trust proxy'); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
export default class Server {
  constructor (app: Application) {
    this.config(app)
    // eslint-disable-next-line no-new
    new Routes(app)
  }

  public config (app: Application): void {
    /* const accessLogStream: WriteStream = fs.createWriteStream(
      path.join(__dirname, './logs/access.log'),
      { flags: 'a' }
    ); */
    // app.use(morgan('combined', { stream: accessLogStream }));
    app.use(urlencoded({ extended: true }))
    app.use(cors({
      origin: '*'
    }))
    app.use(json())
  }
}

process.on('beforeExit', function (err) {
  winston.error(JSON.stringify(err))
  console.error(err)
})
