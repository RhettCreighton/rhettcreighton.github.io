exports.model = Model = {
    Game: {},
    Board: {},
    Move: {}
};

/*
 * Copyright (c) 2013 - Jocly - www.jocly.com - All rights reserved
 */

Model.Game.InitGame = function() {
	var aGame=this;
	var size=this.mOptions.size;
	var coord=[]; // coord[position] = [row,col,height]
	var g=[];	  // g[position][direction] = neighbor_position | null if outside
	var index=0;
	//var hBase=[0,16,25,29];
	var hBase0=0;
	var hBase=[];
	for(var h=0;h<size;h++) {
		hBase.push(hBase0);
		hBase0+=(size-h)*(size-h);
	} 
	for(var h=0;h<size;h++) 
		for(var r=0;r<size-h;r++)
			for(var c=0;c<size-h;c++) {
				var pos=index++;
				coord[pos]=[r,c,h];
				g[pos]=[];
				/* down */
				for(var dr=0;dr<2;dr++)
					for(var dc=0;dc<2;dc++) {
						var h0=h-1;
						var r0=r+dr;
						var c0=c+dc;
						if(h0>=0 && h0<size && r0>=0 && r0<size-h0 && c0>=0 && c0<size-h0)
							g[pos].push(hBase[h0]+r0*(size-h0)+c0);
						else
							g[pos].push(null);
					}
				/* same level */
				var dirs=[[0,-1],[0,1],[-1,0],[1,0]];
				for(var i=0; i<dirs.length; i++) {
					var dir=dirs[i];
					var h0=h;
					var r0=r+dir[0];
					var c0=c+dir[1];
					if(h0>=0 && h0<size && r0>=0 && r0<size-h0 && c0>=0 && c0<size-h0)
						g[pos].push(hBase[h0]+r0*(size-h0)+c0);
					else
						g[pos].push(null);
				}
				/* up */
				for(var dr=-1;dr<1;dr++)
					for(var dc=-1;dc<1;dc++) {
						var h0=h+1;
						var r0=r+dr;
						var c0=c+dc;
						if(h0>=0 && h0<size && r0>=0 && r0<size-h0 && c0>=0 && c0<size-h0)
							g[pos].push(hBase[h0]+r0*(size-h0)+c0);
						else
							g[pos].push(null);
					}
			}
	this.g.Graph=g;
	this.g.Coord=coord;
	
	// go to position at same r and c, 2 levels above /below
	this.g.Over=[];
	this.g.Beneath=[];
	for(var pos=0;pos<this.g.Graph.length;pos++) {
		this.g.Over[pos]=null;
		this.g.Beneath[pos]=null;
	}
	for(var pos=0;pos<this.g.Graph.length;pos++) {
		var coord=this.g.Coord[pos];
		for(var pos1=pos+1;pos1<this.g.Graph.length;pos1++) {
			var coord1=this.g.Coord[pos1];
			if(coord1[2]==coord[2]+2 && coord1[0]==coord[0]-1 && coord1[1]==coord[1]-1) {
				this.g.Over[pos]=pos1;
				this.g.Beneath[pos1]=pos;
				break;
			}
		}
	}

	// walk through neighbor positions
	this.g.EachDirection = function(pos,fnt) {
		for(var i=0;i<12;i++) {
			var npos=aGame.g.Graph[pos][i];
			if(npos!=null)
				if(fnt(npos,i)==false)
					return;
		}
	}
	// walk through down neighbors positions
	this.g.EachDirectionDown = function(pos,fnt) {
		var dirs=[0,1,2,3];
		for(var i=0;i<dirs.length;i++) {
			var npos=aGame.g.Graph[pos][dirs[i]];
			if(npos!=null)
				if(fnt(npos,dirs[i])==false)
					return;
		}
	}
	// walk up neighbors positions
	this.g.EachDirectionUp = function(pos,fnt) {
		var dirs=[8,9,10,11];
		for(var i=0;i<dirs.length;i++) {
			var npos=aGame.g.Graph[pos][dirs[i]];
			if(npos!=null)
				if(fnt(npos,dirs[i])==false)
					return;
		}
	}
	// walk up neighbors positions at same z
	this.g.EachDirectionFlat = function(pos,fnt) {
		var dirs=[4, 5, 6, 7];
		for(var i=0;i<dirs.length;i++) {
			var npos=aGame.g.Graph[pos][dirs[i]];
			if(npos!=null)
				if(fnt(npos,dirs[i])==false)
					return;
		}
	}
	// walk up neighbors positions at same z or below
	this.g.EachDirectionFlatDown = function(pos,fnt) {
		var dirs=[0, 1, 2, 3, 4, 5, 6, 7];
		for(var i=0;i<dirs.length;i++) {
			var npos=aGame.g.Graph[pos][dirs[i]];
			if(npos!=null)
				if(fnt(npos,dirs[i])==false)
					return;
		}
	}
	// walk up neighbors positions at same z or above
	this.g.EachDirectionFlatUp = function(pos,fnt) {
		var dirs=[4, 5, 6, 7, 8, 9, 10, 11];
		for(var i=0;i<dirs.length;i++) {
			var npos=aGame.g.Graph[pos][dirs[i]];
			if(npos!=null)
				if(fnt(npos,dirs[i])==false)
					return;
		}
	}

	this.zobrist=new JocGame.Zobrist({
		board: {
			type: "array",
			size: this.g.Graph.length,
			values: [0,1],
		}
	});

	this.InitGameExtra();
}

Model.Game.MapSameLevelDiagGraph = function() {
	var hBase=[0,16,25,29];
	for(var h=0;h<4;h++) 
		for(var r=0;r<4-h;r++)
			for(var c=0;c<4-h;c++) {
				var pos=hBase[h]+r*(4-h)+c;
				for(var dr=-1;dr<2;dr+=2)
					for(var dc=-1;dc<2;dc+=2) {
						var h0=h;
						var r0=r+dr;
						var c0=c+dc;
						if(h0>=0 && h0<4 && r0>=0 && r0<4-h0 && c0>=0 && c0<4-h0)
							this.g.Graph[pos].push(hBase[h0]+r0*(4-h0)+c0);
						else
							this.g.Graph[pos].push(null);
					}
			}
}

Model.Game.InitGameExtra = function() {
}

Model.Game.DestroyGame = function() {
	this.DestroyGameExtra();
}

Model.Game.DestroyGameExtra = function() {
}

Model.Game.spUpdateZobrist = function(sign,adds,addsSide,removes,removesSide,who) {
	for(var i=0;i<adds.length;i++)
		sign=this.zobrist.update(sign,"board",addsSide,adds[i]);
	for(var i=0;i<removes.length;i++)
		sign=this.zobrist.update(sign,"board",removesSide,removes[i]);
	return sign;
}

Model.Move.Init = function(args) {
	for(var p in args) 
		if(args.hasOwnProperty(p))
			this[p]=JSON.parse(JSON.stringify(args[p]));
}

Model.Move.ToString = function() {
	var color=['?','W','B','R'][this.clr];
	var str="";
	switch(this.act) {
	case "+":
		str+="+"+this.pos+color;
		break;
	case ">":
		str+=this.from+">"+this.to+color;
		break;
	}
	return str;
}

Model.Board.Init = function(aGame) {
}

Model.Board.InitialPosition = function(aGame) {
	this.spInitialPosition(aGame);
}

Model.Board.spInitialPosition = function(aGame) {
	this.board=[]; // access balls by position
	for(var i=0; i<aGame.g.Graph.length; i++)
		this.board[i]=0;
	this.maxLayer=0;
	this.ballCount=[0,0,0];
	this.playables={};
	this.height=[0,0,0];
	this.zSign=0;
	// can put ball at ground level z=0
	for(var i=0;i<aGame.mOptions.size*aGame.mOptions.size;i++)
		this.playables[i]=true;
}

Model.Board.MakeFreeMoves = function(aGame) {
	var moves=[];
	for(var pos in this.playables)
		if(this.playables.hasOwnProperty(pos))
			moves.push({ act: '+', pos: pos, clr: this.mWho==JocGame.PLAYER_A?1:2 });
	return moves;
}

Model.Board.GenerateMoves = function(aGame) {
	var moves=this.GenerateAllMoves(aGame);
	var moveLimit=aGame.mOptions.moveCount;
	if(moves.length==0) {
		this.mFinished=true;
		if(this.ballCount[1]>this.ballCount[2])
			this.mWinner=JocGame.PLAYER_A;
		else if(this.ballCount[1]<this.ballCount[2])
			this.mWinner=JocGame.PLAYER_B;
		else
			this.mWinner=JocGame.DRAW;
	} else if(moveLimit!==undefined && moves.length>moveLimit) {
		aGame.ArrayShuffle(moves);
		moves.sort(function(m1,m2) {
			m2.nextBoard.evaluation-m1.nextBoard.evaluation;
		});
		moves.splice(moveLimit,moves.length-moveLimit);
	}
	this.mMoves=moves;
}

Model.Board.GenerateAllMoves = function(aGame) {
	var moves=this.MakeFreeMoves(aGame);
	return moves;
}

Model.Board.Evaluate = function(aGame,aFinishOnly,aTopLevel) {
	this.mEvaluation = 0;
}

Model.Board.ApplyMove = function(aGame,move) {
	this.spApplyMove(aGame,move);
}

Model.Board.spApplyMove = function(aGame,move) {
	//console.log("spApplyMove",move)
	var $this=this;
	function UpdatePlayables(pos) {
		delete $this.playables[pos]; // position cannot be played anymore
		aGame.g.EachDirectionFlat(pos,function(pos1,dir) {
			if($this.board[pos1]) {
				var dir0,pdir;
				switch(dir) {
				case 4: dir0=7; pdir=10; break;
				case 5: dir0=6; pdir=9; break; 
				case 6: dir0=4; pdir=8; break;
				case 7: dir0=5; pdir=11; break;
				}
				var pos0=aGame.g.Graph[pos][dir0];
				if(pos0!==null && $this.board[pos0]>0 &&
						$this.board[aGame.g.Graph[pos1][dir0]])
					$this.playables[aGame.g.Graph[pos][pdir]]=true;
			}
		});		
	}
	switch(move.act) {
	case "+":
		this.board[move.pos]=move.clr;
		var h=aGame.g.Coord[move.pos][2];
		if(h>this.maxLayer)
			this.maxLayer=h;
		this.height[move.clr]+=h;
		this.ballCount[move.clr]++;

		// check 2x2 platform 
		UpdatePlayables(move.pos);
		break;
	case ">":
		if(move.down.length>0)
			this.playables[move.down[move.down.length-1]]=true;
		else
			this.playables[move.from]=true;
		var from=move.from;
		for(var i=0; i<move.down.length; i++) {
			var down=move.down[i];
			this.height[this.board[down]]--;
			this.board[from]=this.board[down];
			from=down;
		}
		this.board[from]=0;
		this.board[move.to]=move.clr;
		var h=aGame.g.Coord[move.to][2];
		this.height[move.clr]+=h;
		if(h>this.maxLayer)
			this.maxLayer=h;
		UpdatePlayables(move.to);
		break;
	}
}

Model.Board.IsValidMove = function(aGame,move) {
	return true;
}

Model.Board.ExtendMove = function(aGame,pos) {
	return {};
}	

Model.Board.GetSignature = function() {
	return this.zSign;
}	

/*
 * Copyright (c) 2013 - Jocly - www.jocly.com - All rights reserved
 */

/*
 * Move data model:
 * {
 *   'act': always string '+' in the case of Margo
 *   'pos': the ball position to be added
 *   'clr': the ball color: 1=White, 2=Black
 * }
 * 
 * Board data model:
 * {
 *   'board': array of all possible positions (91 in the case of size 6). Each array item has value 0 if empty, 1 if white ball, 2 if black ball
 *   'ballCount': map containing the number of balls on the board. ballCount[1] is the number of player A (black ?) balls, ballCount[-1] player B balls count
 *   'lastMove': the last move that has been played. Used to implement the KO rule (?)
 *  }
 *  
 * Useful data:
 * 
 * - aGame.g.Coord[pos]=[row,col,height] : given a position pos, the array returns the coordinate.
 *     Example: on a size 6 board: aGame.g.Coord[53]=>[3,2,1] 4th row, 3rd column, 2nd layer
 *     
 * - aGame.g.Graph[pos][dir]=newPos : gives the position newPos next to position pos towards the given direction
 * 		dir = 0  down north west
 *            1  down north east
 *            2  down south west
 *            3  down south east
 *            4  same layer west
 *            5  same layer east
 *            6  same layer north
 *            7  same layer south
 *            8  up north west
 *            9  up north east
 *            10 up south west
 *            11 up south east
 *     Example: on a size 6: aGame.g.Coord[53][1]=21
 */

Model.Board.InitialPosition = function(aGame) {
	this.spInitialPosition(aGame);
	this.groupMaxId=1;
	this.groups={}; // groups
	this.posGroup={}; // position to group mapping
	this.posFree={};
	this.center=0; // useful to evaluate center occupation
	this.moveEvaluation=0;
}

Model.Board.GenerateAllMoves = function(aGame) {
	var moves=this.MakeFreeMoves(aGame);
	var moves0=[];
	for(var i=0;i<moves.length;i++) {
		var move=moves[i];
		var moveData=this.ExtendMove(aGame,move.pos);
		if(moveData!==null) {
			move.nextBoard=moveData.board;
			move.remove=moveData.remove;
			// handle ko
			var koPrevent=false;
			if(aGame.mVisitedBoards && aGame.mVisitedBoards[move.nextBoard.zSign]) {
				koPrevent=true;
				//console.log("Ko rule prevents playing",move.pos,aGame.mVisitedBoards);
			}
			if(koPrevent==false)
				moves0.push(move);
		}
	}
	return moves0;
}

Model.Board.ExtendMove = function(aGame,pos,side,boardBase) {
	
	if(arguments.length<3)
		side=0;
	if(arguments.length<4)
		boardBase=null;
	if(boardBase==null)
		boardBase=this;
	var board=JSON.parse(JSON.stringify({
		board: boardBase.board,
		playables: boardBase.playables,
		ballCount: boardBase.ballCount,
		groups: boardBase.groups,
		posFree: boardBase.posFree,
		posGroup: boardBase.posGroup,
		groupMaxId: boardBase.groupMaxId,
		center: boardBase.center,
		zSign: boardBase.zSign,
		mWho: boardBase.mWho,
	}));
	var del={};
	if(side==0)
		side=this.mWho==JocGame.PLAYER_A?1:2;
	var oppSide=3-side;
	var coord=aGame.g.Coord[pos];
	var z=coord[2];
	var touchingSelfGroups={};
	var touchingSelfGroupsCount=0;
	var touchingOppGroups={};
	var touchingOppGroupsCount=0;
	var touchingFreedoms={};
	var touchingFreedomsCount=0;
	var cuttingDirs={4:[8,10],5:[9,11],6:[8,9],7:[10,11]};
	var cutDirs={4:[0,2],5:[1,3],6:[0,1],7:[2,3]};
	var resurrect={};

	/*
	 * Remove group by id. 
	 * Removable positions are deleted from board data.
	 * Zombies are kept and groups are recreated for holding them.
	 */
	function DeleteGroup(gi) {
		var group=board.groups[gi];
		var zombies={};
		var freedoms={};
		var tbd=[];
		for(var p in group.p) 
			if(group.p.hasOwnProperty(p)) {
				tbd.push({
					p: p,
					z: aGame.g.Coord[p][2],
				});
			}
		tbd.sort(function(a1,a2) { // higher position first to be deleted to prevent zombification by a position that will be deleted
			return a2.z-a1.z;
		});
		for(var i=0;i<tbd.length;i++) {
			var entry=tbd[i];
			var p=entry.p;
			var zombie=false;
			aGame.g.EachDirectionUp(p,function(pos1) {
				if(board.board[pos1] || pos1==pos) {
					zombie=true;
					return false;
				}
				return true;
			});
			if(zombie) {
				zombies[p]=true;
				board.posGroup[p]=-1;
			} else {
				if(entry.z==0) // position may become a freedom for other groups
					freedoms[p]=true;
				board.board[p]=0;
				del[p]=true;
				delete board.posGroup[p];
				board.ballCount[group.side]--;
				board.playables[p]=true;
				aGame.g.EachDirectionUp(p,function(pos1) {
					if(board.playables[pos1])
						delete board.playables[pos1];
					return true;
				});
				var beneath=aGame.g.Beneath[p];
				if(beneath) {
					// handle resurrected position
					var rSide=board.board[beneath];
					if(rSide==group.side) {         // resurrecting same color as group being deleted
						var touchGroup=false; // check if resurrected touch group being deleted
						aGame.g.EachDirectionDown(p,function(pos1) {
							if(board.board[pos1]==group.side) {
								touchGroup=true;
								return false;
							}
							return true;
						});
						if(touchGroup) {
							group.p[beneath]=true;
							group.pCount++;
							board.posGroup[beneath]=gi;
							var tbdEntry={
								p: beneath,
								z: aGame.g.Coord[beneath][2],
							};
							for(var j=i+1;j<tbd.length && tbdEntry.z<tbd[j].z;j++);
							tbd.splice(j,0,tbdEntry); // insert into to the to-be-deleted list
						} else {
							resurrect[beneath]=true; // mark for group to be rebuilt later
						}
					} else						  // otherwise
						resurrect[beneath]=true; // mark for group to be rebuilt later 
				}
			}
		}
		for(var f in group.f)
			if(group.f.hasOwnProperty(f))
				delete board.posFree[f][gi];
		delete board.groups[gi];

		// handle generated freedoms
		for(var f in freedoms) 
			if(freedoms.hasOwnProperty(f)) {
				aGame.g.EachDirectionFlat(f,function(pos1) {
					var g=board.posGroup[pos1];
					if(g!==undefined && g>0) {
						if(board.posFree[f]===undefined)
							board.posFree[f]={};
						if(board.posFree[f][g]===undefined) {
							board.posFree[f][g]=true;
							var group=board.groups[g];
							group.f[f]=true;
							group.fCount++;
						}
					}
					return true;
				});
			}
		
		// create groups for zombies
		for(var p in zombies)
			if(zombies.hasOwnProperty(p))
				if(board.posGroup[p]==-1)
					AddGroup(BuildGroup(p));
	}
	
	/*
	 * Invalidate group by id. 
	 * Group is removed from board.groups, board.posGroup set to -1 for belonging positions, freedoms are given back,
	 * but board.board remains unchanged as balls are not physically removed. 
	 */
	function InvalidateGroup(gi) {
		var group=board.groups[gi];
		for(var p in group.p)
			if(group.p.hasOwnProperty(p))
				if(board.posGroup[p]!=0) { // do not mark buried positions as invalid
					board.posGroup[p]=-1;
				}
		for(var f in group.f)
			if(group.f.hasOwnProperty(f))
				delete board.posFree[f][gi];
		delete board.groups[gi];
	}
	
	/*
	 * Create a group object starting from a position.
	 * The board object is not altered. 
	 */
	function BuildGroup(pos0) {
		//console.log("BuildGroup",arguments)
		var side0=board.board[pos0];
		var group={
			side: side0,
			p: {},
			pCount: 1,
			f: {},
			fCount: 0,
		}
		group.p[pos0]=true;
		/*
		var over=aGame.g.Over[p];
		if(over!=null && board.board[over]!=0) {
			console.log("buried group on pos",p);
			return group;
		}
		*/
		var queue=[pos0];
		while(queue.length>0) {
			var pos1=queue.pop();
			aGame.g.EachDirection(pos1,function(pos2,dir2) {
				var side2=board.board[pos2];
				if(side2==side0) {
					if(pos2 in group.p)
						return true;
					var over2=aGame.g.Over[pos2];
					if(over2!==null && (board.board[over2]!=0 || pos==over2))
						return true;
					var cutDirs=cuttingDirs[dir2];
					if(cutDirs!==undefined) {
						var cut0=aGame.g.Graph[pos1][cutDirs[0]];
						var cut1=aGame.g.Graph[pos1][cutDirs[1]];
						if(((cut0==pos && side0==oppSide) || board.board[cut0]==3-side0) &&
							((cut1==pos && side0==oppSide) || board.board[cut1]==3-side0))
							return true;
					}
					group.p[pos2]=true;
					group.pCount++;
					queue.push(pos2);
				} else if(side2==0 && pos2!=pos) {
					if(aGame.g.Coord[pos2][2]==0) {
						if(pos2 in group.f)
							return true;
						group.f[pos2]=true;
						group.fCount++;
					}
				}
				return true;
			});
		}
		return group;
	}
	
	/*
	 * Update the board object to insert an already built group.
	 */
	function AddGroup(group) {
		var gid=board.groupMaxId++;
		board.groups[gid]=group;
		for(var p in group.p) 
			if(group.p.hasOwnProperty(p)) {
				var gid0=board.posGroup[p]
				board.posGroup[p]=gid;
			}
		for(var f in group.f) 
			if(group.f.hasOwnProperty(f)) {
				if(board.posFree[f]===undefined)
					board.posFree[f]={};
				board.posFree[f][gid]=true;
			}
		return gid;
	}
	
	/*
	 * Merge groups while adding position pos0
	 * If pos0=-1, only merge the groups
	 */
	function MergeGroups(pos0,groups) {
		var gids=[];
		for(var gi in groups)
			if(groups.hasOwnProperty(gi))
				gids.push(gi);
		var gi0=gids[0];
		var group0=board.groups[gi0];
		for(var i=1;i<gids.length;i++) {
			var gi=gids[i];
			var group=board.groups[gi];
			for(var p in group.p) 
				if(group.p.hasOwnProperty(p)) {
					group0.p[p]=true;
					board.posGroup[p]=gi0;
				}
			group0.pCount+=group.pCount;
			for(var f in group.f) 			
				if(group.f.hasOwnProperty(f)) {
					if(!(f in group0.f)) {
						group0.f[f]=true;
						group0.fCount++;
					}
					delete board.posFree[f][gi];
					board.posFree[f][gi0]=true;
				}
			delete board.groups[gi];
		}
		if(pos0>=0) {
			for(var f in touchingFreedoms) 
				if(touchingFreedoms.hasOwnProperty(f)) {
					if(!(f in group0.f)) {
						group0.f[f]=true;
						group0.fCount++;
					}
					if(board.posFree[f]===undefined)
						board.posFree[f]={};
					board.posFree[f][gi0]=true;				
				}
			group0.p[pos0]=true;
			group0.pCount++;
			board.posGroup[pos0]=gi0;
		}
	}
	
	/*
	 * Add position to group
	 */
	function AddToGroup(pos0,gi,touchingFreedoms) {
		var group=board.groups[gi];
		for(var f in touchingFreedoms)
			if(touchingFreedoms.hasOwnProperty(f))
				if(!(f in group.f)) {
					group.f[f]=true;
					group.fCount++;
					if(board.posFree[f]===undefined)
						board.posFree[f]={};
					board.posFree[f][gi]=true;
				}
		group.p[pos0]=true;
		group.pCount++;
		board.posGroup[pos0]=gi;		
	}

	//========== ExtendMove function starts here ==========================================================================================================

	var startingPoints={}; // map of positions to rebuild groups from

	/* Get burial */
	var beneath=aGame.g.Beneath[pos];
	if(beneath!=null) {
		// remove from belonging group
		var gi=board.posGroup[beneath];
		var group=board.groups[gi];
		delete group.p[beneath];
		group.pCount--;
		board.posGroup[beneath]=0;
		var bSide=board.board[beneath];
		var bZ=aGame.g.Coord[beneath][2];
		// mark neighbors as starting points to recalculate groups
		aGame.g.EachDirection(beneath,function(pos1,dir1) {
			var side1=board.board[pos1];
			var bZ1=aGame.g.Coord[pos1][2];
			if(bZ1==bZ) {
				var cutDirs=cuttingDirs[dir1];
				var cut0=aGame.g.Graph[beneath][cutDirs[0]];
				var cut1=aGame.g.Graph[beneath][cutDirs[1]];
				if(cut0!=null && board.board[cut0]==3-bSide && cut1!=null || board.board[cut1]==3-bSide)
					return true;
			}
			if(side1==bSide && board.posGroup[pos1]>0)
				startingPoints[pos1]=true;
			return true;
		});
	}
	
	/* Get cuts */
	if(z>0)
		aGame.g.EachDirectionFlat(pos,function(pos1,dir1) {
			if(board.board[pos1]==side) {
				var cutDirs1=cutDirs[dir1];
				var cut0=aGame.g.Graph[pos][cutDirs1[0]];
				var cut1=aGame.g.Graph[pos][cutDirs1[1]];
				if(board.board[cut0]==oppSide && board.board[cut1]==oppSide) {
					if(board.posGroup[cut0])
						startingPoints[cut0]=true;
					if(board.posGroup[cut1])
						startingPoints[cut1]=true;
				}
			}
			return true;
		});
	
	/* Get groups to be invalidated */
	var invalidGroups={}
	for(var p in startingPoints) 
		if(startingPoints.hasOwnProperty(p)) {
			var g=board.posGroup[p];
			invalidGroups[g]=true;
		}
	
	/* Invalidate groups */
	for(var g in invalidGroups)
		if(invalidGroups.hasOwnProperty(g))
			InvalidateGroup(g);
	
	/* Get newGroups from startingPoints */
	for(var p in startingPoints)
		if(startingPoints.hasOwnProperty(p))
			if(board.posGroup[p]<0)
				AddGroup(BuildGroup(p));

	/* Update state: replace killedGroups with new Groups */

	/* Get touchingSelfGroups, touchingOppGroups, touchingFreedoms (z=0) */
	aGame.g.EachDirection(pos,function(pos1) {
		if(board.board[pos1]==0) // empty position
			return true;
		var gid=board.posGroup[pos1];
		if(gid==0) // buried
			return true;
		if(board.board[pos1]==side) {
			if(touchingSelfGroups[gid]===undefined) {
				touchingSelfGroups[gid]=true;
				touchingSelfGroupsCount++;
			}
		} else if(board.board[pos1]==oppSide) {
			if(touchingOppGroups[gid]===undefined) {
				touchingOppGroups[gid]=true;
				touchingOppGroupsCount++;
			}
		}
		return true;
	});
	if(z==0) // ground level
		aGame.g.EachDirectionFlat(pos,function(pos1) {
			if(board.board[pos1]==0) {
				touchingFreedoms[pos1]=true;
				touchingFreedomsCount++;
			}
			return true;
		});

	/* Remove from freedoms */
	var freedoms=board.posFree[pos];
	if(freedoms!==undefined) {
		for(var g in freedoms) 
			if(freedoms.hasOwnProperty(g)) {
				var group=board.groups[g];
				delete group.f[pos];
				group.fCount--;
			}
		delete board.posFree[pos];
	}
	
	/* if count(touchingSelfGroups)==0: create new group */
	if(touchingSelfGroupsCount==0) {
		var group={
			side: side,
			p: {},
			pCount: 1,
			f: touchingFreedoms,
			fCount: touchingFreedomsCount,			
		}
		group.p[pos]=true;
		AddGroup(group);
	} else if(touchingSelfGroupsCount==1) {
		/* if count(touchingSelfGroups)==1: add to group */
		for(var gi in touchingSelfGroups)
			if(touchingSelfGroups.hasOwnProperty(gi))
				break;
		AddToGroup(pos,gi,touchingFreedoms);
	} else {
		/* if count(touchingSelfGroups)>1: merge groups */
		MergeGroups(pos,touchingSelfGroups);
	}
	
	/* Remove all opponent groups with no freedom, get unburied points */
	var deletedGroups=false;
	for(var gi in board.groups)
		if(board.groups.hasOwnProperty(gi)) {
			if(gi==0) // special case: buried pos
				continue;
			var group=board.groups[gi];
			if(group.side!=oppSide)
				continue;
			if(group.fCount==0) {
				DeleteGroup(gi);
				deletedGroups=true;
			}
		}
	
	/* Reattach unburied points */
	for(var p in resurrect) 
		if(resurrect.hasOwnProperty(p)) {
			//console.log("Playing",pos,"resurrects",p);
			if(board.posGroup[p]!=0) // group owning the resurrected point has already been reconstructed
				continue;
			var rSide=board.board[p];
			var rGroups={};
			var rGroupsCount=0;
			var rFreedoms={};
			var rFreedomsCount=0;
			var rZ=aGame.g.Coord[p][2];
			aGame.g.EachDirection(p,function(pos1,dir1) {
				if(board.board[pos1]==0) // empty position
					return true;
				var gid=board.posGroup[pos1];
				if(gid==0) // buried
					return true;
				var rZ1=aGame.g.Coord[pos1][2];
				if(rZ1==rZ) {
					var cutDirs=cuttingDirs[dir1];
					var cut0=aGame.g.Graph[p][cutDirs[0]];
					var cut1=aGame.g.Graph[p][cutDirs[1]];
					if(cut0!=null && board.board[cut0]==3-rSide && cut1!=null && board.board[cut1]==3-rSide)
						return true;
				}
				if(board.board[pos1]==rSide) {
					if(rGroups[gid]===undefined) {
						rGroups[gid]=true;
						rGroupsCount++;
					}
				} else if(board.board[pos1]==0 && aGame.g.Coord[pos1][2]==0) {
					rFreedoms[pos1]=true;
					rFreedomsCount++;
				}
				return true;
			});
			//console.log("rGroupsCount",rGroupsCount,rGroups);
			if(rGroupsCount==0) {
				var group={
					side: rSide,
					p: {},
					pCount: 1,
					f: rFreedoms,
					fCount: rFreedomsCount,			
				}
				group.p[p]=true;
				var gi=AddGroup(group);
			} else if(rGroupsCount==1) {
				for(var gi in rGroups)
					if(rGroups.hasOwnProperty(gi))
						break;
				AddToGroup(p,gi,{});
			} else {
				MergeGroups(p,rGroups);
			}
		}
	
	/* Reconnect self groups as opponent deletion may have removed some cuts */
	if(deletedGroups) {
		var selfGroups=[];
		for(var gi in board.groups) 
			if(board.groups.hasOwnProperty(gi)) {
				if(gi==0) // special case: buried pos
					continue;
				var group=board.groups[gi];
				if(group.side==side)
					selfGroups.push(gi);
			}
		selfGroups.sort(function(a,b) {
			return parseInt(a)-parseInt(b);
		});
		var merges=[];
		for(var i=0;i<selfGroups.length;i++) {
			var gi=selfGroups[i];
			var group=board.groups[gi];
			for(var p in group.p) 
				if(group.p.hasOwnProperty(p)) {
					var groups={};
					aGame.g.EachDirectionFlat(p,function(pos1,dir1) {
						if(board.board[pos1]!=side)
							return true;
						var gi1=board.posGroup[pos1];
						if(gi1!=gi && gi1!=0) {
							var cutDirs=cuttingDirs[dir1];
							var cut0=aGame.g.Graph[p][cutDirs[0]];
							var cut1=aGame.g.Graph[p][cutDirs[1]];
							if(cut0==null || board.board[cut0]!=oppSide || cut1==null || board.board[cut1]!=oppSide) {
								var merge0=null;
								var obsoleteMergeIdx=[];
								for(var j=0;j<merges.length;j++) {
									var merge=merges[j];
									if((gi in merge) || (gi1 in merge)) {
										if(merge0) {
											for(var gi2 in merge)
												if(merge.hasOwnProperty(gi2))
													merge0[gi2]=true;
											obsoleteMergeIdx.push(j);
										} else {
											merge[gi]=true;
											merge[gi1]=true;
											merge0=merge;
										}
									}
								}
								for(var j=obsoleteMergeIdx.length-1;j>=0;j--)
									merges.splice(obsoleteMergeIdx[j],1);
								if(merge0==null) {
									var merge={};
									merge[gi]=true;
									merge[gi1]=true;
									merges.push(merge);
								}
							}
						}
						return true;
					});
				}
		}
		for(var i=0;i<merges.length;i++)
			MergeGroups(-1,merges[i]);
	}
	
	/* if self move with no freedom, return null */
	for(var gi in board.groups) 
		if(board.groups.hasOwnProperty(gi)) {
			if(gi==0) // special case: buried pos
				continue;
			var group=board.groups[gi];
			if(group.side!=side)
				continue;
			if(group.fCount==0) {
				// group has no freedom but if all points in group are pinned, the move is valid
				for(var p in group.p) 
					if(group.p.hasOwnProperty(p)) {
						var pinned=false;
						aGame.g.EachDirectionUp(p,function(pos1) {
							if(board.board[pos1]>0) {
								pinned=true;
								return false;
							}
							return true;
						});
						if(pinned==false)
							return null;
					}
			}
		}

	/* Debug: check consistency here */
	/*
	var tmpBoard=new (aGame.GetBoardClass())(aGame);
	tmpBoard.CopyFrom(this);
	var move={
		act: "+",
		pos: pos,
		clr: side,
		nextBoard: board,
	}
	tmpBoard.ApplyMove(aGame,move);
	if(!tmpBoard.CheckConsistency(aGame)) {
		console.log("Playing",pos,"side",side,": extend consistency error");
		aGame.Save();
		confirm("stopped");
		debugger;
	}
	*/

	/*--- Get move quality -------------------------------------------------------------*/
	
	var active=[];
	for(var gi in board.groups) 
		if(board.groups.hasOwnProperty(gi)) {
			var group=board.groups[gi];
			group.eyes=0;
			for(var p in group.p) 
				if(group.p.hasOwnProperty(p)) {
					active.push({
						p: p,
						z: aGame.g.Coord[p][2],
						group: group,
						gid: gi,
					});
				}
		}
	active.sort(function(a1,a2) { // higher position first
		return a2.z-a1.z;
	});
	var pinners={};
	var balls={};
	for(var i=0;i<active.length;i++) {
		var ball=active[i];
		var pinned0=false;
		aGame.g.EachDirectionUp(ball.p,function(pos1) {
			var pinner0=pinners[pos1];
			if(pinner0!==undefined && (ball.group.side & (3-pinner0))) {
				pinned0=true;
				return false;
			}
			return true;
		});
		ball.pinned=pinned0;
		balls[ball.p]=ball;
		pinners[ball.p]=pinned0?3:ball.group.side;
	}
	
	var eyes={}
	for(var f in board.posFree) 
		if(board.posFree.hasOwnProperty(f)) {
			var fgi=0;
			var isEye=true;
			aGame.g.EachDirectionFlat(f,function(pos1) {
				var side1=board.board[pos1];
				if(side1==0) {
					isEye=false;
					return false;
				}
				var gid=board.posGroup[pos1];
				if(fgi!=0 && gid!=fgi) {
					isEye=false;
					return false;
				}
				fgi=gid;
				return true;
			});
			if(fgi==0)
				isEye=false;
			if(isEye)
				board.groups[fgi].eye++;
		}
	
	board.relativeSecured=0;  // relative measure of number of balls and safety of balls 
	board.relativeHeight=0;   // relative measure of ball height
	

	var evParam=aGame.mOptions.levelOptions;
	
	for(var gi in board.groups) 
		if(board.groups.hasOwnProperty(gi)) {
			var group=board.groups[gi];
			var who=group.side==1?1:-1;
			var safety=evParam.evalSafety;
			if(group.eyes>=2)
				safety=evParam.evalSafety2eyes+Math.log(group.eyes-1)*evParam.evalSafetyXEyesBonus;
			else if(group.fCount==1)
				safety=evParam.evalSafety1f;
			else if(group.fCount==3)
				safety=evParam.evalSafety3f;
			else if(group.fCount>3)
				safety=evParam.evalSafety3fMore+Math.log(group.fCount-3)*evParam.evalSafety3fMoreBonus;
			if(group.eyes==1)
				safety+=evParam.evalSafety1eyeBonus;
			for(var p in group.p) 
				if(group.p.hasOwnProperty(p)) {
					var ball=balls[p];
					var pSafe=safety;
					if(ball.pinned)
						pSafe+=evParam.evalSafetyPinnedBonus; // ball is pinned, increase its safety
					board.relativeSecured+=pSafe*who;
					board.relativeHeight+=ball.z*who;
				}
		}

	if(z==0) { // give a little advantage to center for ground balls
		var who=side==1?1:-1;
		var center=Math.abs(coord[0]-(aGame.mOptions.size-1)/2)+Math.abs(coord[1]-(aGame.mOptions.size-1)/2);
		board.center+=center*who*-1;
	}

	board.moveEvaluation=board.relativeSecured+evParam.evalHeightRatio*board.relativeHeight+evParam.evalCenterRatio*board.center;
	
	var remove=[];
	for(var d in del)
		if(del.hasOwnProperty(d))
			remove.push(d);
	
	board.zSign=aGame.spUpdateZobrist(board.zSign,[pos],side-1,remove,2-side);
	
	return {
		board: board,
		remove: remove,
	}	
}

Model.Board.Evaluate = function(aGame,aFinishOnly,aTopLevel) {
	this.mEvaluation=this.moveEvaluation;
}

// for debug only
Model.Board.CheckConsistency = function(aGame) {
	var ballCount=[0,0,0];
	for(var pos=0;pos<aGame.g.Graph.length;pos++) {
		var coord=aGame.g.Coord[pos];
		var side=this.board[pos];
		if(side>0) {
			var gid=this.posGroup[pos];
			if(gid===undefined) {
				console.error("pos",pos,"side",side,"not assigned to any group");
				return false;
			}
			if(this.posFree[pos]) {
				var g=null;
				for(g in this.posFree[pos])
					if(this.posFree[pos].hasOwnProperty(g))
						break;
				if(g!=null) {
					console.error("pos",pos,"side",side,"set as free for group",g);
					return false;					
				}
			}
			ballCount[side]++;
		} else {
			if(this.posGroup[pos]) {
				console.error("empty pos",pos,"in posGroup");
				return false;												
			}
		}
		var over=aGame.g.Over[pos];
		if(over!=null && this.board[over]>0 && this.posGroup[pos]!=0) {
			console.error("buried ball",pos,"does not have posGroup 0 but",this.posGroup[pos]);
			return true;
		}
	}
	if(ballCount[1]!=this.ballCount[1] || ballCount[2]!=this.ballCount[2]) {
		console.error("ball count mismatch, got",ballCount[1],ballCount[2],"expecting",this.ballCount[1],this.ballCount[2]);
		return false;												
	}
	for(var pos in this.posGroup) 
		if(this.posGroup.hasOwnProperty(pos)) {
			if(this.board[pos]==0) {
				console.error("posGroup pos",pos,"is empty");
				return false;								
			}
			if(this.posGroup[pos]!=0) {
				if(this.groups[this.posGroup[pos]]===undefined) {
					console.error("posGroup",pos,"in unknown group",this.posGroup[pos]);
					return false;								
				}
				if(!(pos in this.groups[this.posGroup[pos]].p)) {
					console.error("posGroup",pos,"does not match group");
					return false;					
				}
			}
		}
	for(var pos in this.posFree) 
		if(this.posFree.hasOwnProperty(pos)) {
			if(this.board[pos]!=0) {
				console.error("posFree pos",pos,"is not empty");
				return false;								
			}
		for(var gi in this.posFree[pos]) 
			if(this.posFree[pos].hasOwnProperty(gi)) {
				var group=this.groups[gi];
				if(group===undefined) {
					console.error("posFree pos",pos,"group",gi,"does not exist");
					return false;								
				}
				if(!(pos in group.f)) {
					console.error("posFree pos",pos,"group",gi,"not in group freedoms");
					return false;								
				}
			}
	}
	for(var gi in this.groups) 
		if(this.groups.hasOwnProperty(gi)) {
			var group=this.groups[gi];
			var count=0;
			for(var pos1 in group.p) 
				if(this.group.p.hasOwnProperty(pos1)) {
					if(this.board[pos1]==0) {
						console.error("pos",pos1,"in group",gi,"marked as empty");
						return false;				
					}
					if(this.board[pos1]!=group.side) {
						console.error("pos",pos1,"in group",gi,"has wrong side");
						return false;								
					}
					if(this.posGroup[pos1]!=gi) {
						console.error("pos",pos1,"in group",gi,"has wrong group",this.posGroup[pos1]);
						return false;												
					}
					count++;
				}
			if(count!=group.pCount) {
				console.error("group",gi,"count mismatch");
				return false;												
			}
			count=0;
			for(var pos1 in group.f) 
				if(group.f.hasOwnProperty(pos1)) {
					if(this.board[pos1]!=0) {
						console.error("freedom pos",pos1,"in group",gi,"is not empty");
						return false;												
					}
					var coord1=aGame.g.Coord[pos1];
					if(coord1[2]!=0) {
						console.error("freedom pos",pos1,"in group",gi,"not at ground level");
						return false;																
					}
					if(this.posFree[pos1]===undefined) {
						console.error("freedom pos",pos1,"in group",gi,"not in freedoms");
						return false;												
					}
					if(!this.posFree[pos1][gi]) {
						console.error("freedom pos",pos1,"in group",gi,"is not empty for group");
						return false;												
					}
					count++;
				}
			if(count!=group.fCount) {
				console.error("group",gi,"freedom count mismatch");
				return false;												
			}
		}
	return true;
}

Model.Board.ApplyMove = function(aGame,move) {
	if(move.nextBoard===undefined) {
		var mData=this.ExtendMove(aGame,move.pos);
		if(!mData)
			console.log("move",move,JSON.stringify(aGame.mPlayedMoves));
		this.CopyFrom(mData.board);
	} else
		this.CopyFrom(move.nextBoard);
	this.spApplyMove(aGame,move);
	
	/*
	if(!this.CheckConsistency(aGame)) {
		console.log("consistency error while playing",move);
		debugger;
		aGame.Save();
		confirm("stopped");
	}
	*/
}

Model.Board.CopyFrom = function(aBoard) {
	this.groupMaxId=aBoard.groupMaxId;
	this.center=aBoard.center;
	this.maxLayer=aBoard.maxLayer;
	this.zSign=aBoard.zSign;
	this.mWho=aBoard.mWho;
	this.moveEvaluation=aBoard.moveEvaluation;
	this.board=[];
	this.ballCount=[0,aBoard.ballCount[1],aBoard.ballCount[2]];
	for(var pos=0;pos<aBoard.board.length;pos++)
		this.board.push(aBoard.board[pos]);
	this.playables={};
	for(var pos in aBoard.playables)
		if(aBoard.playables.hasOwnProperty(pos))
			this.playables[pos]=true;
	this.groups={};
	for(var gi in aBoard.groups) 
		if(aBoard.groups.hasOwnProperty(gi)) {
			var group0=aBoard.groups[gi];
			var group={
				side: group0.side,
				p: {},
				pCount: group0.pCount,
				f: {},
				fCount: group0.fCount,
			}
			for(var pos in group0.p)
				if(group0.p.hasOwnProperty(pos))
					group.p[pos]=true;
			for(var pos in group0.f)
				if(group0.f.hasOwnProperty(pos))
					group.f[pos]=true;
			this.groups[gi]=group;
		}
	this.posFree={};
	for(var pos in aBoard.posFree) 
		if(aBoard.posFree.hasOwnProperty(pos)) {
			var posFree={};
			for(var g in aBoard.posFree[pos])
				if(aBoard.posFree[pos].hasOwnProperty(g))
					posFree[g]=true;
			this.posFree[pos]=posFree;
		}
	this.posGroup={};
	for(var pos in aBoard.posGroup)
		if(aBoard.posGroup.hasOwnProperty(pos))
			this.posGroup[pos]=aBoard.posGroup[pos];
	if(aBoard.height)
		this.height=[0,aBoard.height[1],aBoard.height[2]];
	else
		this.height=[0,0,0];
	if(aBoard.mEvaluation!==undefined)
		this.mEvaluation=aBoard.mEvaluation;
	if(aBoard.mFinished!==undefined)
		this.mFinished=aBoard.mFinished;
	if(aBoard.mWinner!==undefined)
		this.mWinner=aBoard.mWinner;
}
	
/**
 * Debug function for saving a game
 */
Model.Game.Save = function() {
	var data={
			playedMoves: [],
			game: JoclyHub.modelName,
	}
	for(var i=0;i<this.mPlayedMoves.length;i++) {
		var move = new (this.GetMoveClass())(this.mPlayedMoves[i]);
		delete move.nextBoard;
		delete move.remove;
		delete move.boardJSON;
		data.playedMoves.push(move);
	}
	var now=new Date();
	data['date']=""+now.getFullYear()+"-"+(now.getMonth()+1)+"-"+now.getDate()+"-"+now.getHours()+"_"+now.getMinutes()+"_"+now.getSeconds();
	if(JoclyHub.network.connected) {
		$(".jocly-temp").remove();
		var form = document.createElement("form");
		form.setAttribute("class", "jocly-temp");
		form.setAttribute("style", "display: none;");
	    form.setAttribute("method", "post");
	    form.setAttribute("action", "/jocly/save-game");
	    //form.setAttribute("target","_blank");
	    var hiddenField = document.createElement("input");
	    hiddenField.setAttribute("type","hidden");
		hiddenField.setAttribute("name", "data");
		hiddenField.setAttribute("value", JSON.stringify(data));
		form.appendChild(hiddenField);
		document.body.appendChild(form);                      
		form.submit();				
	} else {
		// note filename does not work for data URI
		var fileName=data.game+"-"+data.date+".joc";
		var uriContent = "data:application/x-joc;filename="+fileName+"," + encodeURIComponent(JSON.stringify(data));
		window.open(uriContent,fileName);
	}
}

Model.Move.Strip = function() {
	if(this.nextBoard!==undefined || this.remove!==undefined) {
		var move={};
		for(var p in this) {
			if(this.hasOwnProperty(p) && p!="nextBoard"/* && p!="remove" */)
				move[p]=JSON.parse(JSON.stringify(this[p]));
		}
		return move;
	}
	return this;
}

//# sourceMappingURL=margo6-model.js.map
