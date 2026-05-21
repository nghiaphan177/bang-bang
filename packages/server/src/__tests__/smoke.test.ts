import { GameWebSocketServer } from '../network/WebSocketServer';
import WebSocket from 'ws';
import { ClientMessageType, ServerMessageType, TankId } from '@bang-bang/shared';

async function runTest() {
  console.log('[Smoke Test] Starting test server on port 9099...');
  const server = new GameWebSocketServer(9099);

  try {
    // Wait a bit for server to listen
    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log('[Smoke Test] Connecting client to ws://localhost:9099...');
    const ws = new WebSocket('ws://localhost:9099');

    // Return a promise that resolves when the test succeeds
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Test timed out after 5 seconds'));
      }, 5000);

      ws.on('open', () => {
        console.log('[Smoke Test] Connected. Sending Join message...');
        const joinMsg = {
          type: ClientMessageType.Join,
          playerId: 'test_player_1',
          tankId: TankId.IronMan,
          playerName: 'SmokeTester',
        };
        ws.send(JSON.stringify(joinMsg));
      });

      ws.on('message', (data) => {
        const raw = data.toString();
        const msg = JSON.parse(raw);
        console.log(`[Smoke Test] Received server message of type: ${msg.type}`);

        if (msg.type === ServerMessageType.Error) {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(`Server error: ${msg.message}`));
        }

        if (msg.type === ServerMessageType.Snapshot) {
          console.log('[Smoke Test] Successfully received game snapshot!');
          const snapshot = msg.snapshot;
          console.log(`[Smoke Test] Snapshot Tick: ${snapshot.tick}`);
          console.log(`[Smoke Test] Snapshot Tanks Count: ${snapshot.tanks.length}`);
          
          if (snapshot.tanks.length > 0) {
            const playerTank = snapshot.tanks[0];
            console.log(`[Smoke Test] Player HP: ${playerTank.hp}/${playerTank.maxHp}, position: (${playerTank.position.x.toFixed(2)}, ${playerTank.position.y.toFixed(2)})`);
          }

          // Assertions
          if (typeof snapshot.tick !== 'number') {
            reject(new Error('snapshot.tick is not a number'));
            return;
          }
          if (!Array.isArray(snapshot.tanks)) {
            reject(new Error('snapshot.tanks is not an array'));
            return;
          }
          if (!Array.isArray(snapshot.projectiles)) {
            reject(new Error('snapshot.projectiles is not an array'));
            return;
          }

          console.log('[Smoke Test] All assertions passed!');
          clearTimeout(timeout);
          ws.close();
          resolve();
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

  } finally {
    console.log('[Smoke Test] Closing server...');
    server.close();
  }
}

runTest()
  .then(() => {
    console.log('[Smoke Test] Server smoke test PASSED successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Smoke Test] Server smoke test FAILED:', err);
    process.exit(1);
  });
