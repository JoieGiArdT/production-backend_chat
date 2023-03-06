import axios from 'axios'
class NinoxService {
  async uploadImage (
    data: any
  ): Promise<void> {
    await axios('https://api.ninox.com/v1/teams/42n8NnWkqqpZm9TYs/databases/yt04u58u0kr5/tables/A/records/1/files/', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: 'Bearer 34f68770-b3f3-11ed-a8cd-313be7742ae4'
      },
      data
    })
  }

  async createField (
    data: any
  ): Promise<void> {
    await axios('https://api.ninox.com/v1/teams/42n8NnWkqqpZm9TYs/databases/yt04u58u0kr5/tables/C/records', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer 34f68770-b3f3-11ed-a8cd-313be7742ae4'
      },
      data
    })
  }

  async searchField (
    numero: string
  ): Promise<string[]> {
    return (await axios(`https://api.ninox.com/v1/teams/42n8NnWkqqpZm9TYs/databases/yt04u58u0kr5/query?query=select 'Funcionarios' where 'Numero' = "${numero}"`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer 34f68770-b3f3-11ed-a8cd-313be7742ae4'
      }
    })).data
  }

  async getField (
    id: string
  ): Promise<any> {
    return (await axios(`https://api.ninox.com/v1/teams/42n8NnWkqqpZm9TYs/databases/yt04u58u0kr5/tables/D/records/${id.substring(1)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer 34f68770-b3f3-11ed-a8cd-313be7742ae4'
      }
    })).data
  }
}
const ninoxService = new NinoxService()
export { ninoxService }
