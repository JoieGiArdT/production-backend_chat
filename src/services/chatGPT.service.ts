import { Configuration, OpenAIApi } from 'openai'
class ChatGPTService {
  private readonly apiKey = String(process.env.OIA_KEY)
  async requestChatGPT (
    prompts: string
  ): Promise<string> {
    const configuration = new Configuration({
      organization: 'org-00Q6Bey8RjIS5ZbdXuysfmFG',
      apiKey: this.apiKey
    })
    const openai = new OpenAIApi(configuration)
    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [{
        role: 'user',
        content: prompts
      }]
    })
    return String(response.data.choices[0])
  }
}
const chatGPTService = new ChatGPTService()

export { chatGPTService }
