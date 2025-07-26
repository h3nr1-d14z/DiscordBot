# Discord Fun Bot - Technical Documentation

## Bot Architecture

### Command Structure
Commands use Discord.js's SlashCommandBuilder for modern slash command support.

```typescript
interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: CommandInteraction) => Promise<void>;
  cooldown?: number;
  category: CommandCategory;
}
```

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  balance INTEGER DEFAULT 100,
  daily_streak INTEGER DEFAULT 0,
  last_daily DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Game Stats Table
```sql
CREATE TABLE game_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  game_type TEXT NOT NULL,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  high_score INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

#### Active Games Table
```sql
CREATE TABLE active_games (
  game_id TEXT PRIMARY KEY,
  game_type TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  players TEXT NOT NULL, -- JSON array
  game_state TEXT NOT NULL, -- JSON object
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Game Implementations

### Tic-Tac-Toe
- Uses button interactions for moves
- Supports PvP and PvBot modes
- AI uses minimax algorithm for bot moves
- Game state stored in memory with timeout

### Trivia System
- Questions fetched from Open Trivia Database API
- Categories: General, Science, History, Entertainment, etc.
- Difficulty levels: Easy, Medium, Hard
- Points based on difficulty and response time

### Economy System
- Starting balance: 100 coins
- Daily reward: 50-200 coins (with streak bonus)
- Game rewards based on performance
- Shop system for cosmetic items

## API Integrations

### External APIs
1. **Open Trivia Database**: `https://opentdb.com/api.php`
2. **Joke API**: `https://v2.jokeapi.dev/joke/`
3. **Meme API**: `https://meme-api.com/gimme`
4. **Weather API**: OpenWeatherMap

### Rate Limiting
- Command cooldowns per user
- Global rate limit handling
- API request caching

## Deployment Configuration

### Environment Variables
```env
# Bot Configuration
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
GUILD_ID=your_guild_id_for_testing

# Database
DATABASE_PATH=./data/bot.db

# APIs
WEATHER_API_KEY=your_api_key

# Cloudflare
TUNNEL_TOKEN=your_tunnel_token

# Features
ENABLE_ECONOMY=true
ENABLE_LEVELING=true
DEFAULT_PREFIX=!
```

### Cloudflare Tunnel Setup
```yaml
tunnel: your-tunnel-id
credentials-file: /path/to/credentials.json

ingress:
  - hostname: bot.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

### Docker Configuration
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

VOLUME ["/app/data"]

CMD ["npm", "start"]
```

## Performance Optimizations

### Caching Strategy
- Command responses cached for 5 minutes
- User data cached with TTL
- Game states in Redis for multi-instance support

### Database Optimizations
- Indexed columns for frequent queries
- Connection pooling
- Prepared statements

## Error Handling

### Error Types
1. **User Errors**: Invalid input, permissions
2. **System Errors**: Database, API failures
3. **Game Errors**: Invalid moves, timeouts

### Error Responses
- User-friendly error messages
- Detailed logging for debugging
- Automatic error recovery where possible

## Testing Strategy

### Unit Tests
- Command logic testing
- Game mechanics validation
- Utility function tests

### Integration Tests
- Database operations
- API interactions
- Discord.js mocking

### Example Test
```typescript
describe('TicTacToe Game', () => {
  test('should detect winning condition', () => {
    const board = ['X', 'X', 'X', 'O', 'O', '', '', '', ''];
    expect(checkWinner(board)).toBe('X');
  });
});
```

## Monitoring

### Metrics to Track
- Command usage statistics
- Response times
- Error rates
- Active users
- Game completion rates

### Health Checks
```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    discord: client.ws.status === 0 ? 'connected' : 'disconnected'
  });
});
```