# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Cloudflare Workers application that implements an AI-powered Tic-Tac-Toe game using the Cloudflare Agents SDK. The application demonstrates real-time state synchronization between a React frontend and a Durable Object-backed Agent running on Cloudflare's edge.

**Key Features:**
- **Player vs AI Mode**: Human player (X) competes against GPT-4o AI opponent (O)
- **AI vs AI Mode**: Watch two AI agents battle autonomously with automatic game restart
- **Real-time State Sync**: WebSocket-based state updates with AI thinking indicators
- **Automatic Game Management**: Games auto-restart after completion with persistent statistics
- **Modern UI**: Material Icons, responsive design with game statistics and mode switching

## Architecture

**Agent-Based Architecture:**

- `TicTacToe` class extends `Agent<Env, TicTacToeState>` from the `agents` package
- The Agent manages game state using Durable Objects with SQLite storage (`new_sqlite_classes` migration)
- State changes are automatically synchronized to connected clients via WebSockets
- AI opponent uses OpenAI GPT-4o via `@ai-sdk/openai` for move generation

**Request Routing:**

- `routeAgentRequest()` handles automatic routing to agents at `/some/prefix/agents/:agent/:name`
- The custom prefix `"some/prefix"` is configured in both server and client

**State Management:**

- Agent state (`TicTacToeState`) includes:
  - `board`: 3x3 grid of `Player | null` values
  - `currentPlayer`: Current turn ("X" or "O")
  - `winner`: Game result (`Player | null`)
  - `mode`: Game mode (`"player-vs-ai" | "ai-vs-ai"`)
  - `isAiThinking`: Boolean flag for AI thinking state (used for UI feedback)
- `setState()` triggers automatic state sync to all connected clients via WebSockets
- React client uses `useAgent()` hook with `onStateUpdate` callback to receive state changes in real-time
- Mode persists across board clears to maintain user's game selection

**Frontend-Backend Communication:**

- Frontend: `useAgent()` hook from `agents/react` establishes WebSocket connection
- Backend: `@callable()` decorator exposes methods (`makeMove`, `clearBoard`, `setMode`) as remotely invocable
- Client calls agent methods via `agent.call("methodName", [args])`
- React Router manages navigation between menu (`/`) and game modes (`/player`, `/ai`)
- Route parameters determine initial game mode configuration

## Development Commands

**Start development server:**

```bash
npm start
```

Runs Vite dev server with hot reload at http://localhost:5173

**Run tests:**

```bash
npm test
```

Executes Vitest with Cloudflare Workers test environment

**Type checking:**

```bash
npm run check
```

Runs Prettier check, Biome linting, and TypeScript compilation

**Format code:**

```bash
npm run format
```

Formats all files with Prettier

**Generate types for bindings:**

```bash
npm run types
```

Generates TypeScript types for Cloudflare bindings in `env.d.ts`

**Deploy to Cloudflare:**

```bash
npm run deploy
```

Builds with Vite and deploys to Cloudflare Workers

## Key Implementation Details

**Agent Callable Methods:**

- Use `@callable()` decorator to expose methods to clients
- `makeMove(move: [number, number], player: Player)`:
  - Validates move is from current player and cell is empty
  - Updates board state and switches current player
  - Checks for winner using `checkWinner()` helper
  - Sets `isAiThinking: true` before AI move generation
  - Conditionally triggers AI move based on mode and current player
  - In "ai-vs-ai" mode: AI plays both sides automatically
  - In "player-vs-ai" mode: AI only plays as "O"
  - Recursively calls itself for AI moves after generation
- `clearBoard()`: Resets game to initial state while preserving current mode
- `setMode(mode: GameMode)`: Updates game mode ("player-vs-ai" or "ai-vs-ai")
- All methods use `this.setState()` which automatically syncs to all connected clients

**AI Move Generation:**

- Uses `generateObject()` from `ai` package with OpenAI GPT-4o model
- Structured output via Zod schema: `z.object({ move: z.array(z.number()) })`
- Comprehensive prompt includes:
  - Current board state (JSON format)
  - Player assignment and game rules
  - Board coordinate system ([row, col] from 0-2)
  - Strategic priorities (ordered by importance):
    1. Win immediately if possible
    2. Block opponent's winning move
    3. Take center position [1,1]
    4. Create forks (multiple winning opportunities)
    5. Block opponent's fork opportunities
    6. Take corners
    7. Take edges
- AI recursively calls `this.makeMove()` to execute its generated move
- Error handling with console logging for debugging AI decisions
- `isAiThinking` flag set before generation, cleared after move execution
- Requires `OPENAI_API_KEY` environment variable (configured via Wrangler secrets or vars)

**Durable Object Configuration:**

- Agent class must be listed in both `durable_objects.bindings` and `migrations.new_sqlite_classes`
- The migration tag ensures proper SQLite initialization for state persistence
- Agent instances are identified by names (e.g., "tic-tac-toe") via routing

**Frontend State Sync:**

- `useAgent()` automatically establishes WebSocket connection on mount
- `onStateUpdate` callback receives full state object on every `setState()` call from Agent
- Local React state mirrors Agent state for immediate UI updates
- **Menu System**: Landing page with mode selection buttons (Player vs AI / AI vs AI)
- **Game Statistics**: Real-time tracking of X wins, O wins, and draws with visual stat cards
- **Games Counter**: Persistent counter showing total games played in current session
- **AI Thinking Indicator**: Shows "AI is thinking..." status with psychology icon during AI moves
- **Automatic Game Restart**: 3-second delay after game completion before auto-reset
- **Cell Interaction**:
  - Disabled in AI vs AI mode (watch-only)
  - Disabled when AI is thinking (prevents race conditions)
  - Disabled on filled cells or when game is over
- **AI vs AI Auto-start**: Random first move triggered automatically after 500ms delay
- **Material Icons**: Uses Material Icons Round for all UI elements (close for X, circle for O)

## Game Flow & Lifecycle

**Player vs AI Mode:**
1. User selects "Play vs AI" from menu → navigates to `/player`
2. Frontend calls `setMode("player-vs-ai")` and `clearBoard()`
3. User (X) clicks cell → `makeMove([row, col], "X")` called
4. Agent validates, updates state, checks winner, switches to O
5. Agent detects O's turn in player-vs-ai mode → sets `isAiThinking: true`
6. AI generates move via GPT-4o → recursively calls `makeMove([row, col], "O")`
7. Agent updates state with AI's move, sets `isAiThinking: false`
8. Frontend receives state update → UI reflects new board state
9. Repeat steps 3-8 until winner or draw
10. Game auto-restarts after 3 seconds, stats updated

**AI vs AI Mode:**
1. User selects "AI vs AI" from menu → navigates to `/ai`
2. Frontend calls `setMode("ai-vs-ai")` and `clearBoard()`
3. Frontend triggers random first move after 500ms
4. Each AI move triggers next AI move automatically (both X and O)
5. Game plays autonomously until completion
6. Auto-restart continues indefinitely, building statistics

**Critical Implementation Patterns:**
- **Recursive AI Moves**: AI calls `this.makeMove()` on itself, maintaining turn-based flow
- **Conditional AI Triggering**: Logic checks both mode and currentPlayer to determine if AI should play
- **State Preservation**: `clearBoard()` preserves mode, ensuring game type persists across resets
- **Race Condition Prevention**: `isAiThinking` flag prevents user clicks during AI computation
- **Initialization Sequence**: Mode set before board clear to ensure proper initial state

## Environment Configuration

The project follows Cloudflare Workers best practices for modern applications:

**Required Environment Variables:**

- `OPENAI_API_KEY`: Set via `wrangler secret put OPENAI_API_KEY` for production or in `.dev.vars` for local development

**Wrangler Configuration:**

- Uses `wrangler.jsonc` (not `wrangler.toml`)
- Compatibility date: `2025-08-03`
- Compatibility flags: `nodejs_compat` enabled
- AI binding with remote enabled for Workers AI access
- Observability enabled for logging
- Assets served from `public/` directory for static frontend files

## File Structure

- `src/server.ts`: Agent class definition and Worker entrypoint
  - `TicTacToe` class with `@callable()` methods
  - `checkWinner()` helper for win condition detection
  - AI move generation logic with OpenAI integration
  - Request routing via `routeAgentRequest()`
- `src/client.tsx`: React application with `useAgent()` integration
  - `Menu` component for game mode selection
  - `Game` component with React Router integration
  - State synchronization and statistics tracking
  - Material Icons integration for UI elements
- `src/styles.css`: Game styling with modern CSS
  - Grid-based board layout
  - Player color schemes (X and O)
  - AI thinking animations
  - Responsive stat cards and controls
- `wrangler.jsonc`: Cloudflare Workers configuration
  - Durable Object bindings for `TicTacToe`
  - SQLite migrations configuration
  - AI binding with remote enabled
  - Assets directory configuration
- `vite.config.ts`: Build configuration with Cloudflare, React, and Tailwind plugins
- `package.json`: Dependencies and scripts
  - `agents` package (v0.2.21) for Agent SDK
  - `@ai-sdk/openai` for AI integration
  - `react-router-dom` for navigation
  - Development tools: Vitest, Prettier, Biome, TypeScript

## Common Development Tasks

**Adding New Callable Methods:**
1. Define method in `TicTacToe` class with `@callable()` decorator
2. Update `TicTacToeState` type if new state fields needed
3. Call method from frontend via `agent.call("methodName", [args])`
4. State changes automatically sync to all connected clients

**Modifying AI Behavior:**
- Edit prompt in `makeMove()` method (lines 96-117 in src/server.ts)
- Adjust strategic priorities or add new rules
- Change model by updating `openai("gpt-4o")` parameter
- Test with AI vs AI mode for rapid iteration

**Adding New Game Modes:**
1. Update `GameMode` type in src/server.ts
2. Add mode to `TicTacToeState` initial state
3. Update conditional logic in `makeMove()` AI triggering (lines 77-79)
4. Add new route and menu button in src/client.tsx
5. Handle mode initialization in `useEffect` (lines 92-114)

**Debugging Tips:**
- Check browser console for AI move logs: "🤖 AI is thinking...", "✅ AI chose move:"
- Use `npm run check` to catch type errors before deployment
- Monitor Cloudflare Workers logs via dashboard for production issues
- Test both game modes thoroughly after changes to move validation logic
- Verify WebSocket connection in browser DevTools Network tab

**Testing Workflow:**
1. Run `npm start` for local development with hot reload
2. Test Player vs AI mode for user interaction flows
3. Test AI vs AI mode for autonomous operation and edge cases
4. Run `npm run check` for linting and type checking
5. Run `npm test` for Vitest suite execution
6. Deploy with `npm run deploy` after verification
