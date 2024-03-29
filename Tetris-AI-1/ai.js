class AI extends Player {
    constructor(canvas, training, weights) {
        super(canvas);
        //old parameters: heightSum, completedLines, holes, bumpiness
        //new params: completedLinesMin, completedLinesMax, holes, bumpiness, rowsWithHoles
        this.weights = weights;

        this.score = 0;
        this.pieceCount = 0;

        this.maxPieceCount = undefined;
        this.maxScore = 100000;

        if (training) {
            //this.fitness = this.determineFitness();
        }
        else {
            this.scoreElt = document.getElementById('score');
        }

        this.moveDelay = 10;
        this.rotateDelay = 5;
        this.downDelay = 5;
        this.testMovesDelay = 0;

        this.startReset = true;

        this.resetCallback;
    }

    delay(ms) {
        return new Promise(function(fulfill, reject) {
            setTimeout(function() {
                fulfill();
            }, ms);
        });
    }

    play() {
        while (true) {
            var bestMove = this.chooseBestMove();
            for (var i = 0 ; i < bestMove.rotation ; i++) {
                this.rotate();
            }
            this.move(bestMove.x, 0);
            while (true) {
                var self = this;
                var end = false;
                if (this.moveDown(function(counter, colliding) {
                    if (self.score % 1000 == 0 && counter > 0) {
                        console.log(self.score);
                    }
                    self.score += counter;
                    if (self.scoreElt) {
                        self.scoreElt.innerHTML = self.score;
                    }
                    if (colliding || self.score >= self.maxScore || self.startReset) {
                        end = true;
                    }
                })) {
                    if (end) {
                        return self.score;
                    }
                    break;
                }
            }

            this.pieceCount++;

            if (this.maxPieceCount !== undefined && this.pieceCount == this.maxPieceCount) {
                return self.score;
            }
        }
    }

    async playAsync() {
        while (true) {
            var bestMove;
            if (this.testMovesDelay == 0) {
                bestMove = this.chooseBestMove();
            }
            else {
                bestMove = await this.chooseBestMoveAsync();
            }
            await this.delay(this.moveDelay);
            for (var i = 0 ; i < bestMove.rotation ; i++) {
                await this.delay(this.rotateDelay);
                this.rotate();
            }
            await this.delay(this.moveDelay);
            this.move(bestMove.x, 0);
            await this.delay(this.moveDelay);
            while (true) {
                var self = this;
                var end = false;
                if (this.moveDown(function(counter, colliding) {
                    self.score += counter;
                    if (self.scoreElt) {
                        self.scoreElt.innerHTML = self.score;
                    }
                    if (colliding || self.startReset) {
                        self.scoreElt.innerHTML = 0;
                        end = true;
                    }
                })) {
                    if (end) {
                        if (typeof self.resetCallback == "function") {
                            self.resetCallback();
                        }
                        return self.score;
                    }
                    break;
                }
                await this.delay(this.downDelay);
            }

            this.pieceCount++;

            // if (this.maxPieceCount !== undefined && this.pieceCount == this.maxPieceCount) {
            //     return self.score;
            // }

            // var heightSum = this.grid.getHeightSum();
            // var completedLines = this.grid.getFullCount();
            // var holes = this.grid.getHoleCount();
            // var bumpiness = this.grid.getBumpiness();
            // console.log("height sum: " + heightSum);
            // console.log("completed lines: " + completedLines);
            // console.log("holes: " + holes);
            // console.log("bumpiness: " + bumpiness);
        }
    }

    chooseBestMove() {
        var bestX;
        var bestRotation;
        var bestScore = null;

        for (var rotation = 0 ; rotation < 4 ; rotation++) {
            var x = 0;
            while (this.move(-1, 0)) {
                x -= 1;
            }

            do {
                while (true) {
                    this.move(0, 1);
                    if (this.collide()) {
                        this.move(0, -1);
                        break;
                    }
                }
                var gridClone = JSON.parse(JSON.stringify(this.grid.grid));
                this.putInGrid();
                var score = this.getMoveScore();
                if (bestScore === null || score > bestScore) {
                    bestX = x;
                    bestRotation = rotation;
                    bestScore = score;
                }
                //await this.delay(100);
                this.grid.grid = gridClone;
                this.resetY();
                x += 1;
            } while (this.move(1, 0));
            this.resetToTop();
            this.rotate();
        }

        this.resetToTop();

        return {
            x: bestX,
            rotation: bestRotation
        };
    }

    async chooseBestMoveAsync() {
        var bestX;
        var bestRotation;
        var bestScore = null;

        var maxRotation = 4;
        var label = this.piece.label;
        if (label == "O") {
            maxRotation = 1;
        }
        else if (label == "I" || label == "S" || label == "Z") {
            maxRotation = 2;
        }

        for (var rotation = 0 ; rotation < maxRotation ; rotation++) {
            var x = 0;
            while (this.move(-1, 0)) {
                x -= 1;
            }

            do {
                while (true) {
                    this.move(0, 1);
                    if (this.collide()) {
                        this.move(0, -1);
                        break;
                    }
                }
                var gridClone = JSON.parse(JSON.stringify(this.grid.grid));
                this.putInGrid();
                var score = this.getMoveScore();
                if (bestScore === null || score > bestScore) {
                    bestX = x;
                    bestRotation = rotation;
                    bestScore = score;
                }
                await this.delay(this.testMovesDelay);
                this.grid.grid = gridClone;
                this.resetY();
                x += 1;
            } while (this.move(1, 0));
            this.resetToTop();
            this.rotate();
        }

        this.resetToTop();
        for (var i = maxRotation ; i < 4 ; i++) {
            this.rotate();
        }

        return {
            x: bestX,
            rotation: bestRotation
        };
    }

    resetY() {
        this.position.y = 0;
    }

    completedLinesScore(completedLines, currentHeight, maxHeight) {
        var min = this.weights.completedLinesMin;
        var max = this.weights.completedLinesMax;
        var weight = min + ((currentHeight / maxHeight) * (max - min));
        return completedLines * weight;
    }

    getMoveScore() {
        //var heightSum = this.grid.getHeightSum();
        var completedLines = this.grid.getFullCount();
        var holes = this.grid.getHoleCount();
        var bumpiness = this.grid.getBumpiness();
        var rowsWithHoles = this.grid.getRowsWithHoles();

        var currentHeight = this.grid.getCurrentHeight();
        var maxHeight = this.grid.getGridHeight();

        // console.log("height sum: " + heightSum);
        // console.log("completed lines: " + completedLines);
        // console.log("holes: " + holes);
        // console.log("bumpiness: " + bumpiness);
        var score = this.completedLinesScore(completedLines, currentHeight, maxHeight)
            - (this.weights.holes * holes) - (this.weights.bumpiness * bumpiness)
            - (this.weights.rowsWithHoles * rowsWithHoles);
        
        return score;
    }

    resetGame() {
        this.pieceCount = 0;
        this.score = 0;
        this.grid = new Grid(this.canvas.width / this.SIZE, this.canvas.height / this.SIZE);
    }

    determineFitness() {
        var totalScore = 0;
        for (var game = 0 ; game < 1 ; game++) {
            this.play();
            totalScore += this.score;
            //totalScore += this.pieceCount;
            this.resetGame();
        }

        return totalScore;
    }

    reset(callback) {
        this.startReset = true;
        this.resetCallback = callback;
    }
}