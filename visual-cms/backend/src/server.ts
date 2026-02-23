import { AppDataSource } from './config/database'
import app from './app'

const PORT = process.env.PORT || 5000

AppDataSource.initialize()
  .then(() => {
    console.log('✅ Database connected')
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`)
      console.log(`📡 API available at http://localhost:${PORT}/api`)
      console.log(`📚 API Docs at http://localhost:${PORT}/api/docs`)
      console.log(`📖 ReDoc at http://localhost:${PORT}/api/docs/redoc`)
    })
  })
  .catch((error) => {
    console.error('❌ Database connection failed:', error)
    process.exit(1)
  })

