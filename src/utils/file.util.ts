import FormData from 'form-data'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

class FileUtil {
  private generateRandomFileName (extension: string): string {
    const randomBytes = crypto.randomBytes(8).toString('hex')
    const timestamp = Date.now().toString()
    return randomBytes + '_' + timestamp + '.' + extension
  }

  async downloadBufferAsFile (buffer: Buffer, type: string = 'pdf'): Promise<string> {
    const fileName = this.generateRandomFileName(type)
    const localFilePath = path.resolve(__dirname, 'downloads', fileName)
    return await new Promise<string>((resolve, reject) => {
      fs.writeFile(localFilePath, buffer, (error) => {
        if (error != null) {
          reject(error)
          return
        }
        resolve(localFilePath)
      })
    })
  }

  openStreamAndgetFileFormData (filePath: string): FormData {
    const fileStream = fs.createReadStream(filePath)
    const formData = new FormData()
    formData.append('file', fileStream)
    formData.append('messaging_product', 'whatsapp')
    return formData
  }

  closeStreamAndDeleteFile (filePath: string): void {
    fs.unlinkSync(filePath)
  }
}
const fileUtil = new FileUtil()
export { fileUtil }
