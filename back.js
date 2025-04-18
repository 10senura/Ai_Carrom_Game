        document.addEventListener('DOMContentLoaded', function() {
            // Game elements
            const carromBoard = document.querySelector('.carrom-board');
            const directionIndicator = document.querySelector('.direction-indicator');
            const powerMeter = document.querySelector('.power-level');
            const player1Score = document.querySelector('.player1 .score');
            const player2Score = document.querySelector('.player2 .score');
            const player1PiecesLeft = document.querySelector('.player1 .pieces-left');
            const player2PiecesLeft = document.querySelector('.player2 .pieces-left');
            const player1Element = document.querySelector('.player1');
            const player2Element = document.querySelector('.player2');
            const queenStatusElement = document.querySelector('.queen-status');
            const gameMessage = document.querySelector('.game-message');
            const restartButton = document.getElementById('restart-btn');
            const rotateLeftBtn = document.querySelector('.rotate-left');
            const rotateRightBtn = document.querySelector('.rotate-right');
            
            // Game state
            let currentPlayer = 1; // 1 or 2
            let striker = null;
            let pieces = [];
            let queen = null;
            let isDragging = false;
            let isPowerAdjusting = false;
            let power = 0;
            let lastPocketedPiece = null;
            let isQueenCovered = false;
            let rotationAngle = 0;
            let gameInProgress = true;
            let physicsInterval = null;
            let animationFrameId = null;
            
            // Scores
            let player1Points = 0;
            let player2Points = 0;
            let player1PiecesRemaining = 9;
            let player2PiecesRemaining = 9;
            
            // Physics constants
            const friction = 0.98;
            const minSpeed = 0.1;
            const maxPower = 20;
            const pocketRange = 25;
            
            // Board dimensions
            const boardWidth = carromBoard.clientWidth;
            const boardHeight = carromBoard.clientHeight;
            
            // Initialize game
            function initGame() {
                clearBoard();
                createPieces();
                createStriker();
                updateScoreboard();
                
                if (physicsInterval) {
                    clearInterval(physicsInterval);
                }
                
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                }
                
                physicsInterval = setInterval(updatePhysics, 16);
                animationFrameId = requestAnimationFrame(gameLoop);
                
                gameInProgress = true;
                currentPlayer = 1;
                player1Points = 0;
                player2Points = 0;
                player1PiecesRemaining = 9;
                player2PiecesRemaining = 9;
                isQueenCovered = false;
                lastPocketedPiece = null;
                
                player1Element.classList.add('active');
                player2Element.classList.remove('active');
                
                gameMessage.style.display = 'none';
            }
            
            function clearBoard() {
                // Remove all existing pieces
                const existingPieces = document.querySelectorAll('.carrom-piece');
                existingPieces.forEach(piece => piece.remove());
                pieces = [];
                queen = null;
                striker = null;
            }
            
            function createPieces() {
                // Create the queen (red piece)
                queen = createPiece('queen', boardWidth / 2 - 15, boardHeight / 2 - 15);
                pieces.push(queen);
                
                // Create white and black pieces arranged in a circle
                const pieceSize = 30;
                const radius = 60;
                const centerX = boardWidth / 2 - pieceSize / 2;
                const centerY = boardHeight / 2 - pieceSize / 2;
                
                // Inner circle
                const innerPositions = 6;
                const innerRadius = 40;
                
                for (let i = 0; i < innerPositions; i++) {
                    const angle = (i * 2 * Math.PI) / innerPositions;
                    const x = centerX + innerRadius * Math.cos(angle);
                    const y = centerY + innerRadius * Math.sin(angle);
                    
                    const type = i % 2 === 0 ? 'white-piece' : 'black-piece';
                    const piece = createPiece(type, x, y);
                    pieces.push(piece);
                }
                
                // Outer circle
                const outerPositions = 12;
                
                for (let i = 0; i < outerPositions; i++) {
                    const angle = (i * 2 * Math.PI) / outerPositions;
                    const x = centerX + radius * Math.cos(angle);
                    const y = centerY + radius * Math.sin(angle);
                    
                    const type = i % 2 === 0 ? 'black-piece' : 'white-piece';
                    const piece = createPiece(type, x, y);
                    pieces.push(piece);
                }
            }
            
            function createPiece(type, x, y) {
                const piece = document.createElement('div');
                piece.className = `carrom-piece ${type}`;
                piece.style.left = `${x}px`;
                piece.style.top = `${y}px`;
                carromBoard.appendChild(piece);
                
                // Add physics properties
                piece.vx = 0;
                piece.vy = 0;
                piece.type = type;
                piece.isMoving = false;
                
                return piece;
            }
            
            function createStriker() {
                striker = document.createElement('div');
                striker.className = 'carrom-piece striker';
                
                // Set initial position at the bottom of the board
                positionStriker();
                
                carromBoard.appendChild(striker);
                
                // Add physics properties
                striker.vx = 0;
                striker.vy = 0;
                striker.type = 'striker';
                striker.isMoving = false;
                
                // Add event listeners for dragging
                striker.addEventListener('mousedown', startDrag);
                striker.addEventListener('touchstart', startDrag, { passive: false });
                
                return striker;
            }
            
            function positionStriker() {
                const strikerSize = 40;
                striker.style.left = `${boardWidth / 2 - strikerSize / 2}px`;
                striker.style.top = `${boardHeight - 100}px`;
            }
            
            function startDrag(e) {
                e.preventDefault();
                if (!gameInProgress || areAnyPiecesMoving()) return;
                
                isDragging = true;
                striker.classList.add('active');
                
                // Add event listeners for dragging
                document.addEventListener('mousemove', dragStriker);
                document.addEventListener('touchmove', dragStriker, { passive: false });
                document.addEventListener('mouseup', releaseDrag);
                document.addEventListener('touchend', releaseDrag);
            }
            
            function dragStriker(e) {
                e.preventDefault();
                if (!isDragging) return;
                
                const rect = carromBoard.getBoundingClientRect();
                let clientX, clientY;
                
                // Handle both mouse and touch events
                if (e.type === 'touchmove') {
                    clientX = e.touches[0].clientX;
                    clientY = e.touches[0].clientY;
                } else {
                    clientX = e.clientX;
                    clientY = e.clientY;
                }
                
                let x = clientX - rect.left - 20; // 20 is half of striker width
                let y = clientY - rect.top - 20;  // 20 is half of striker height
                
                // Constrain to bottom area
                const bottomAreaTop = boardHeight - 100;
                y = Math.max(bottomAreaTop, Math.min(y, boardHeight - 40));
                x = Math.max(20, Math.min(x, boardWidth - 40));
                
                striker.style.left = `${x}px`;
                striker.style.top = `${y}px`;
            }
            
            function releaseDrag() {
                if (!isDragging) return;
                
                isDragging = false;
                striker.classList.remove('active');
                
                // Remove event listeners
                document.removeEventListener('mousemove', dragStriker);
                document.removeEventListener('touchmove', dragStriker);
                document.removeEventListener('mouseup', releaseDrag);
                document.removeEventListener('touchend', releaseDrag);
                
                // Begin aiming mode
                beginAiming();
            }
            
            function beginAiming() {
                // Show direction indicator
                directionIndicator.style.display = 'block';
                directionIndicator.style.left = `${parseInt(striker.style.left) + 20}px`;
                directionIndicator.style.top = `${parseInt(striker.style.top) + 20}px`;
                directionIndicator.style.width = '100px';
                directionIndicator.style.transform = 'rotate(0deg)';
                
                // Add event listeners for aiming
                document.addEventListener('mousemove', aimStriker);
                document.addEventListener('touchmove', aimStriker, { passive: false });
                document.addEventListener('mousedown', startPowerAdjust);
                document.addEventListener('touchstart', startPowerAdjust, { passive: false });
            }
            
            function aimStriker(e) {
                e.preventDefault();
                
                const rect = carromBoard.getBoundingClientRect();
                let clientX, clientY;
                
                // Handle both mouse and touch events
                if (e.type === 'touchmove') {
                    clientX = e.touches[0].clientX;
                    clientY = e.touches[0].clientY;
                } else {
                    clientX = e.clientX;
                    clientY = e.clientY;
                }
                
                const strikerX = parseInt(striker.style.left) + 20;
                const strikerY = parseInt(striker.style.top) + 20;
                
                // Calculate angle
                const dx = clientX - rect.left - strikerX;
                const dy = clientY - rect.top - strikerY;
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                
                // Set direction indicator
                directionIndicator.style.transform = `rotate(${angle}deg)`;
                
                // Store the angle for later use
                striker.angle = angle * Math.PI / 180;
            }
            
            function startPowerAdjust(e) {
                e.preventDefault();
                if (isPowerAdjusting) return;
                
                isPowerAdjusting = true;
                power = 0;
                powerMeter.style.height = '0%';
                
                // Remove aiming event listeners
                document.removeEventListener('mousemove', aimStriker);
                document.removeEventListener('touchmove', aimStriker);
                document.removeEventListener('mousedown', startPowerAdjust);
                document.removeEventListener('touchstart', startPowerAdjust);
                
                // Add power adjustment listeners
                document.addEventListener('mousemove', adjustPower);
                document.addEventListener('touchmove', adjustPower, { passive: false });
                document.addEventListener('mouseup', releaseShot);
                document.addEventListener('touchend', releaseShot);
            }
            
            function adjustPower(e) {
                e.preventDefault();
                
                // Increase power based on distance from original click
                power += 0.5;
                power = Math.min(power, 100);
                
                // Update power meter
                powerMeter.style.height = `${power}%`;
            }
            
            function releaseShot() {
                if (!isPowerAdjusting) return;
                
                isPowerAdjusting = false;
                directionIndicator.style.display = 'none';
                
                // Remove power adjustment listeners
                document.removeEventListener('mousemove', adjustPower);
                document.removeEventListener('touchmove', adjustPower);
                document.removeEventListener('mouseup', releaseShot);
                document.removeEventListener('touchend', releaseShot);
                
                // Apply velocity to striker
                const normalizedPower = (power / 100) * maxPower;
                striker.vx = Math.cos(striker.angle) * normalizedPower;
                striker.vy = Math.sin(striker.angle) * normalizedPower;
                striker.isMoving = true;
                
                // Reset power meter
                powerMeter.style.height = '0%';
            }
            
            function updatePhysics() {
                if (!gameInProgress) return;
                
                let anyMoving = false;
                
                // Update striker if it exists
                if (striker && striker.isMoving) {
                    updatePiecePhysics(striker);
                    anyMoving = anyMoving || striker.isMoving;
                }
                
                // Update all pieces
                for (let i = 0; i < pieces.length; i++) {
                    const piece = pieces[i];
                    if (piece.isMoving) {
                        updatePiecePhysics(piece);
                        anyMoving = anyMoving || piece.isMoving;
                    }
                    
                    // Check for collisions with other pieces
                    checkCollisions(piece);
                }
                
                // If nothing is moving anymore, check for next turn
                if (!anyMoving && striker && striker.vx === 0 && striker.vy === 0) {
                    checkGameStatus();
                }
            }
            
            function updatePiecePhysics(piece) {
                if (!piece.isMoving) return;
                
                // Apply friction
                piece.vx *= friction;
                piece.vy *= friction;
                
                // Check if speed is below threshold
                if (Math.abs(piece.vx) < minSpeed && Math.abs(piece.vy) < minSpeed) {
                    piece.vx = 0;
                    piece.vy = 0;
                    piece.isMoving = false;
                    return;
                }
                
                // Move piece
                const x = parseInt(piece.style.left) + piece.vx;
                const y = parseInt(piece.style.top) + piece.vy;
                
                // Check for wall collisions
                const pieceSize = piece.classList.contains('striker') ? 40 : 30;
                if (x < 0 || x > boardWidth - pieceSize) {
                    piece.vx *= -0.8;
                }
                
                if (y < 0 || y > boardHeight - pieceSize) {
                    piece.vy *= -0.8;
                }
                
                // Update position with constrained values
                piece.style.left = `${Math.max(0, Math.min(boardWidth - pieceSize, x))}px`;
                piece.style.top = `${Math.max(0, Math.min(boardHeight - pieceSize, y))}px`;
                
                // Check for pockets
                checkPockets(piece);
            }
            
            function checkCollisions(piece) {
                if (!piece.isMoving) return;
                
                const pieceX = parseInt(piece.style.left);
                const pieceY = parseInt(piece.style.top);
                const pieceSize = piece.classList.contains('striker') ? 40 : 30;
                
                // Check collisions with striker
                if (striker && piece !== striker) {
                    const strikerX = parseInt(striker.style.left);
                    const strikerY = parseInt(striker.style.top);
                    const strikerSize = 40;
                    const dx = (pieceX + pieceSize/2) - (strikerX + strikerSize/2);
                    const dy = (pieceY + pieceSize/2) - (strikerY + strikerSize/2);
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < (pieceSize/2 + strikerSize/2)) {
                        // Collision detected
                        const angle = Math.atan2(dy, dx);
                        const speed1 = Math.sqrt(piece.vx * piece.vx + piece.vy * piece.vy);
                        const speed2 = Math.sqrt(striker.vx * striker.vx + striker.vy * striker.vy);
                        
                        const direction1 = Math.atan2(piece.vy, piece.vx);
                        const direction2 = Math.atan2(striker.vy, striker.vx);
                        
                        const velocityX1 = speed1 * Math.cos(direction1 - angle);
                        const velocityY1 = speed1 * Math.sin(direction1 - angle);
                        const velocityX2 = speed2 * Math.cos(direction2 - angle);
                        const velocityY2 = speed2 * Math.sin(direction2 - angle);
                        
                        const finalVelocityX1 = ((pieceSize - strikerSize) * velocityX1 + (strikerSize + strikerSize) * velocityX2) / (pieceSize + strikerSize);
                        const finalVelocityX2 = ((pieceSize + pieceSize) * velocityX1 + (strikerSize - pieceSize) * velocityX2) / (pieceSize + strikerSize);
                        
                        piece.vx = Math.cos(angle) * finalVelocityX1 + Math.cos(angle + Math.PI/2) * velocityY1;
                        piece.vy = Math.sin(angle) * finalVelocityX1 + Math.sin(angle + Math.PI/2) * velocityY1;
                        striker.vx = Math.cos(angle) * finalVelocityX2 + Math.cos(angle + Math.PI/2) * velocityY2;
                        striker.vy = Math.sin(angle) * finalVelocityX2 + Math.sin(angle + Math.PI/2) * velocityY2;
                        
                        piece.isMoving = true;
                        striker.isMoving = true;
                        
                        // Adjust positions to prevent sticking
                        const overlap = (pieceSize/2 + strikerSize/2) - distance;
                        if (overlap > 0) {
                            piece.style.left = `${pieceX + overlap * Math.cos(angle)}px`;
                            piece.style.top = `${pieceY + overlap * Math.sin(angle)}px`;
                        }
                    }
                }
                
                // Check collisions with other pieces
                for (let i = 0; i < pieces.length; i++) {
                    const otherPiece = pieces[i];
                    if (piece === otherPiece) continue;
                    
                    const otherX = parseInt(otherPiece.style.left);
                    const otherY = parseInt(otherPiece.style.top);
                    const otherSize = otherPiece.classList.contains('striker') ? 40 : 30;
                    
                    const dx = (pieceX + pieceSize/2) - (otherX + otherSize/2);
                    const dy = (pieceY + pieceSize/2) - (otherY + otherSize/2);
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < (pieceSize/2 + otherSize/2)) {
                        // Collision detected
                        const angle = Math.atan2(dy, dx);
                        const speed1 = Math.sqrt(piece.vx * piece.vx + piece.vy * piece.vy);
                        const speed2 = Math.sqrt(otherPiece.vx * otherPiece.vx + otherPiece.vy * otherPiece.vy);
                        
                        const direction1 = Math.atan2(piece.vy, piece.vx);
                        const direction2 = Math.atan2(otherPiece.vy, otherPiece.vx);
                        
                        const velocityX1 = speed1 * Math.cos(direction1 - angle);
                        const velocityY1 = speed1 * Math.sin(direction1 - angle);
                        const velocityX2 = speed2 * Math.cos(direction2 - angle);
                        const velocityY2 = speed2 * Math.sin(direction2 - angle);
                        
                        const finalVelocityX1 = ((pieceSize - otherSize) * velocityX1 + (otherSize + otherSize) * velocityX2) / (pieceSize + otherSize);
                        const finalVelocityX2 = ((pieceSize + pieceSize) * velocityX1 + (otherSize - pieceSize) * velocityX2) / (pieceSize + otherSize);
                        
                        piece.vx = Math.cos(angle) * finalVelocityX1 + Math.cos(angle + Math.PI/2) * velocityY1;
                        piece.vy = Math.sin(angle) * finalVelocityX1 + Math.sin(angle + Math.PI/2) * velocityY1;
                        otherPiece.vx = Math.cos(angle) * finalVelocityX2 + Math.cos(angle + Math.PI/2) * velocityY2;
                        otherPiece.vy = Math.sin(angle) * finalVelocityX2 + Math.sin(angle + Math.PI/2) * velocityY2;
                        
                        piece.isMoving = true;
                        otherPiece.isMoving = true;
                        
                        // Adjust positions to prevent sticking
                        const overlap = (pieceSize/2 + otherSize/2) - distance;
                        if (overlap > 0) {
                            piece.style.left = `${pieceX + overlap * Math.cos(angle)}px`;
                            piece.style.top = `${pieceY + overlap * Math.sin(angle)}px`;
                        }
                    }
                }
            }
            
            function checkPockets(piece) {
                const pieceX = parseInt(piece.style.left) + (piece.classList.contains('striker') ? 20 : 15);
                const pieceY = parseInt(piece.style.top) + (piece.classList.contains('striker') ? 20 : 15);
                
                // Check each corner pocket
                const pockets = [
                    {x: 0, y: 0},        // Top-left
                    {x: boardWidth, y: 0}, // Top-right
                    {x: 0, y: boardHeight}, // Bottom-left
                    {x: boardWidth, y: boardHeight} // Bottom-right
                ];
                
                for (let i = 0; i < pockets.length; i++) {
                    const pocket = pockets[i];
                    const dx = pieceX - pocket.x;
                    const dy = pieceY - pocket.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < pocketRange) {
                        // Piece is pocketed
                        piece.isMoving = false;
                        piece.vx = 0;
                        piece.vy = 0;
                        
                        if (piece === striker) {
                            // Striker pocketed - foul
                            setTimeout(() => {
                                positionStriker();
                                striker.isMoving = false;
                                changeTurn();
                                showMessage("Striker pocketed! Turn changed.");
                            }, 300);
                        } else {
                            // Regular piece pocketed
                            lastPocketedPiece = piece;
                            piece.style.display = 'none';
                            
                            if (piece === queen) {
                                queenStatusElement.textContent = 'Pocketed';
                                if (!isQueenCovered) {
                                    setTimeout(() => {
                                        // Queen not covered - return to center
                                        queen.style.display = 'block';
                                        queen.style.left = `${boardWidth / 2 - 15}px`;
                                        queen.style.top = `${boardHeight / 2 - 15}px`;
                                        queenStatusElement.textContent = 'In Play';
                                    }, 300);
                                }
                            } else {
                                // Regular piece
                                if (piece.type === 'white-piece') {
                                    player1Points++;
                                    player1PiecesRemaining--;
                                } else if (piece.type === 'black-piece') {
                                    player2Points++;
                                    player2PiecesRemaining--;
                                }
                                
                                updateScoreboard();
                                
                                // Check if queen was covered
                                if (queen && queen.style.display === 'none' && !isQueenCovered) {
                                    if ((currentPlayer === 1 && lastPocketedPiece.type === 'white-piece') ||
                                        (currentPlayer === 2 && lastPocketedPiece.type === 'black-piece')) {
                                        isQueenCovered = true;
                                        queenStatusElement.textContent = 'Covered';
                                        
                                        if (currentPlayer === 1) {
                                            player1Points += 3;
                                        } else {
                                            player2Points += 3;
                                        }
                                        updateScoreboard();
                                    }
                                }
                            }
                            
                            // Remove from pieces array
                            const index = pieces.indexOf(piece);
                            if (index > -1) {
                                pieces.splice(index, 1);
                            }
                        }
                        break;
                    }
                }
            }
            
            function checkGameStatus() {
                // Check if all pieces are pocketed
                const whitePiecesLeft = pieces.filter(p => p.type === 'white-piece').length;
                const blackPiecesLeft = pieces.filter(p => p.type === 'black-piece').length;
                
                if (whitePiecesLeft === 0 && blackPiecesLeft === 0) {
                    // Game over
                    gameInProgress = false;
                    
                    // Determine winner
                    if (player1Points > player2Points) {
                        showMessage(`Player 1 wins! ${player1Points}-${player2Points}`);
                    } else if (player2Points > player1Points) {
                        showMessage(`Player 2 wins! ${player2Points}-${player1Points}`);
                    } else {
                        showMessage("It's a tie!");
                    }
                    return;
                }
                
                // Check if player has pocketed any of their pieces
                if (lastPocketedPiece) {
                    if ((currentPlayer === 1 && lastPocketedPiece.type === 'white-piece') ||
                        (currentPlayer === 2 && lastPocketedPiece.type === 'black-piece')) {
                        // Player gets another turn
                        lastPocketedPiece = null;
                        positionStriker();
                        return;
                    }
                }
                
                // Change turn
                changeTurn();
            }
            
            function changeTurn() {
                currentPlayer = currentPlayer === 1 ? 2 : 1;
                lastPocketedPiece = null;
                
                player1Element.classList.toggle('active');
                player2Element.classList.toggle('active');
                
                positionStriker();
            }
            
            function areAnyPiecesMoving() {
                if (striker && striker.isMoving) return true;
                
                for (let i = 0; i < pieces.length; i++) {
                    if (pieces[i].isMoving) return true;
                }
                
                return false;
            }
            
            function updateScoreboard() {
                player1Score.textContent = player1Points;
                player2Score.textContent = player2Points;
                player1PiecesLeft.textContent = `${player1PiecesRemaining} pieces left`;
                player2PiecesLeft.textContent = `${player2PiecesRemaining} pieces left`;
            }
            
            function showMessage(msg) {
                gameMessage.textContent = msg;
                gameMessage.style.display = 'block';
                
                setTimeout(() => {
                    gameMessage.style.display = 'none';
                }, 3000);
            }
            
            function gameLoop() {
                updatePhysics();
                animationFrameId = requestAnimationFrame(gameLoop);
            }
            
            // Event listeners
            restartButton.addEventListener('click', initGame);
            
            rotateLeftBtn.addEventListener('click', () => {
                rotationAngle -= 5;
                carromBoard.style.transform = `rotateX(20deg) rotateZ(${rotationAngle}deg)`;
            });
            
            rotateRightBtn.addEventListener('click', () => {
                rotationAngle += 5;
                carromBoard.style.transform = `rotateX(20deg) rotateZ(${rotationAngle}deg)`;
            });
            
            // Start the game
            initGame();
        });
