/** biome-ignore-all lint/a11y/noStaticElementInteractions: it's fine */
/** biome-ignore-all lint/a11y/useKeyWithClickEvents: it's fine */
import { useAgent } from "agents/react";
import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Route,
  Routes,
  useNavigate,
  useParams
} from "react-router-dom";
import type { GameMode, TicTacToeState } from "./server";
import "./styles.css";

// Add Material Icons font
const MaterialIconsLink = () => (
  <link
    href="https://fonts.googleapis.com/icon?family=Material+Icons+Round"
    rel="stylesheet"
  />
);

function Menu() {
  const navigate = useNavigate();

  return (
    <div className="menu-container">
      <h1>
        <span className="material-icons-round game-icon">sports_esports</span>
        Tic Tac Toe
      </h1>
      <p className="menu-subtitle">Choose Your Game Mode</p>
      <div className="menu-options">
        <button
          type="button"
          onClick={() => navigate("/player")}
          className="menu-button player-vs-ai"
        >
          <span className="material-icons-round">person</span>
          <span className="menu-button-title">Play vs AI</span>
          <span className="menu-button-desc">You play as X, AI plays as O</span>
        </button>
        <button
          type="button"
          onClick={() => navigate("/ai")}
          className="menu-button ai-vs-ai"
        >
          <span className="material-icons-round">smart_toy</span>
          <span className="menu-button-title">AI vs AI</span>
          <span className="menu-button-desc">Watch two AIs battle it out</span>
        </button>
      </div>
    </div>
  );
}

function Game() {
  const navigate = useNavigate();
  const { mode: modeParam } = useParams<{ mode: string }>();

  // Determine game mode from route
  const gameMode: GameMode = modeParam === "ai" ? "ai-vs-ai" : "player-vs-ai";

  const [state, setState] = useState<TicTacToeState>({
    board: [
      [null, null, null],
      [null, null, null],
      [null, null, null]
    ],
    currentPlayer: "X",
    winner: null,
    mode: gameMode,
    isAiThinking: false
  });
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [stats, setStats] = useState({
    draws: 0,
    oWins: 0,
    xWins: 0
  });
  const agent = useAgent<TicTacToeState>({
    agent: "tic-tac-toe",
    onStateUpdate: (state) => {
      setState(state);
    },
    prefix: "some/prefix"
  });

  // Initialize game mode when component mounts
  // biome-ignore lint/correctness/useExhaustiveDependencies: agent.call is stable
  useEffect(() => {
    const initGame = async () => {
      try {
        await agent.call("setMode", [gameMode]);
        await agent.call("clearBoard");
        setGamesPlayed(0);
        setStats({ draws: 0, oWins: 0, xWins: 0 });

        // For AI vs AI, trigger the first move
        if (gameMode === "ai-vs-ai") {
          setTimeout(async () => {
            const row = Math.floor(Math.random() * 3);
            const col = Math.floor(Math.random() * 3);
            await agent.call("makeMove", [[row, col], "X"]);
          }, 500);
        }
      } catch (error) {
        console.error("Error initializing game:", error);
      }
    };

    initGame();
  }, [gameMode]);

  const backToMenu = () => {
    navigate("/");
  };

  const handleNewGame = useCallback(async () => {
    try {
      await agent.call("clearBoard");
      setGamesPlayed((prev) => prev + 1);
    } catch (error) {
      console.error("Error clearing board:", error);
    }
  }, [agent]);

  const handleCellClick = async (row: number, col: number) => {
    // Disable clicks in AI vs AI mode
    if (state.mode === "ai-vs-ai") return;
    // Disable clicks when AI is thinking
    if (state.isAiThinking) return;
    // Disable clicks on filled cells or when game is over
    if (state.board[row][col] !== null || state.winner) return;

    try {
      await agent.call("makeMove", [[row, col], state.currentPlayer]);
    } catch (error) {
      console.error("Error making move:", error);
    }
  };

  // Check for game over and start new game after delay
  useEffect(() => {
    const isGameOver =
      state.winner ||
      state.board.every((row) => row.every((cell) => cell !== null));

    if (isGameOver) {
      // Update stats
      if (state.winner === "X") {
        setStats((prev) => ({ ...prev, xWins: prev.xWins + 1 }));
      } else if (state.winner === "O") {
        setStats((prev) => ({ ...prev, oWins: prev.oWins + 1 }));
      } else if (isGameOver) {
        setStats((prev) => ({ ...prev, draws: prev.draws + 1 }));
      }

      const timer = setTimeout(() => {
        handleNewGame();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [state.winner, state.board, handleNewGame]);

  const renderCell = (row: number, col: number) => {
    const value = state.board[row][col];
    const isAiVsAi = state.mode === "ai-vs-ai";
    const isDisabled = isAiVsAi || state.isAiThinking;
    return (
      <div
        className={`cell ${value ? "played" : ""} ${isDisabled ? "disabled" : ""}`}
        onClick={() => handleCellClick(row, col)}
        key={`${row}-${col}`}
      >
        {value && (
          <span className={value === "X" ? "player-x" : "player-o"}>
            {value === "X" ? (
              <span className="material-icons-round">close</span>
            ) : (
              <span className="material-icons-round">circle</span>
            )}
          </span>
        )}
      </div>
    );
  };

  const getGameStatus = () => {
    if (state.winner) {
      return (
        <div className="status">
          Winner:{" "}
          <span className={`player-${state.winner.toLowerCase()}`}>
            {state.winner}
          </span>
          !
        </div>
      );
    }
    if (state.board.every((row) => row.every((cell) => cell !== null))) {
      return <div className="status">Game Draw!</div>;
    }
    if (state.isAiThinking) {
      return (
        <div className="status ai-thinking">
          <span className="material-icons-round thinking-icon">psychology</span>
          AI is thinking...
        </div>
      );
    }
    return (
      <div className="status">
        Current Player:{" "}
        <span className={`player-${state.currentPlayer.toLowerCase()}`}>
          {state.currentPlayer}
        </span>
      </div>
    );
  };

  return (
    <div className="game-container">
      <div className="game-header">
        <button type="button" onClick={backToMenu} className="back-button">
          <span className="material-icons-round">arrow_back</span>
        </button>
        <h1>
          <span className="material-icons-round game-icon">sports_esports</span>
          Tic Tac Toe
          <span className="mode-badge">
            {state.mode === "player-vs-ai" ? "vs AI" : "AI vs AI"}
          </span>
        </h1>
      </div>
      {getGameStatus()}
      <div className="board">
        {state.board.map((row, rowIndex) =>
          row.map((_cell, colIndex) => renderCell(rowIndex, colIndex))
        )}
      </div>
      <div className="stats">
        <div className="stat-card player-x-stats">
          <div className="stat-value">{stats.xWins}</div>
          <div className="stat-label">
            <span className="material-icons-round">close</span>
            Wins
          </div>
        </div>
        <div className="stat-card player-o-stats">
          <div className="stat-value">{stats.oWins}</div>
          <div className="stat-label">
            <span className="material-icons-round">circle</span>
            Wins
          </div>
        </div>
        <div className="stat-card draw-stats">
          <div className="stat-value">{stats.draws}</div>
          <div className="stat-label">
            <span className="material-icons-round">handshake</span>
            Draws
          </div>
        </div>
      </div>
      <div className="controls">
        <button
          type="button"
          onClick={handleNewGame}
          className="new-game-button"
        >
          <span className="material-icons-round">refresh</span>
          New Game
        </button>
      </div>
      <div className="games-counter">
        <span className="material-icons-round">analytics</span>
        Games played: {gamesPlayed}
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <MaterialIconsLink />
      <Routes>
        <Route path="/" element={<Menu />} />
        <Route path="/:mode" element={<Game />} />
      </Routes>
    </BrowserRouter>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
