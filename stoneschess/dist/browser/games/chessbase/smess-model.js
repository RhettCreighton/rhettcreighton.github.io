exports.model = Model = {
    Game: {},
    Board: {},
    Move: {}
};


(function() {

	var cbVar;

	var MASK = 0xffff;   // unreachable position
	var FLAG_MOVE = 0x10000; // move to if target pos empty
	var FLAG_CAPTURE = 0x20000; // capture if occupied by enemy
	var FLAG_STOP = 0x40000; // stop if occupied
	var FLAG_SCREEN_CAPTURE = 0x80000; // capture if occupied by and a piece has been jumped in the path (like cannon in xiangqi) 
	var FLAG_CAPTURE_KING = 0x100000; // capture if occupied by enemy king
	var FLAG_CAPTURE_NO_KING = 0x200000; // capture if not occupied by enemy king
	Model.Game.cbConstants = {
		MASK: MASK,
		FLAG_MOVE: FLAG_MOVE,
		FLAG_CAPTURE: FLAG_CAPTURE,
		FLAG_STOP: FLAG_STOP,
		FLAG_SCREEN_CAPTURE: FLAG_SCREEN_CAPTURE,
		FLAG_CAPTURE_KING: FLAG_CAPTURE_KING,
		FLAG_CAPTURE_NO_KING: FLAG_CAPTURE_NO_KING,
	}
	var USE_TYPED_ARRAYS = typeof Int32Array != "undefined";
	
	Model.Game.cbUseTypedArrays = USE_TYPED_ARRAYS; 

	Model.Game.cbTypedArray = function(array) {
		if(USE_TYPED_ARRAYS) {
			var tArray=new Int32Array(array.length);
			tArray.set(array);
			return tArray;
		} else {
			var arr=[];
			var arrLength=array.length;
			for(var i=0;i<arrLength;i++)
				arr.push(array[i]);
			return arr;
		}
	}

	Model.Game.cbShortRangeGraph = function(geometry,deltas,confine,flags) {
		var $this=this;
		if(flags===undefined)
			flags = FLAG_MOVE | FLAG_CAPTURE;
		var graph={};
		for(var pos=0;pos<geometry.boardSize;pos++) {
			graph[pos]=[];
			if(confine && !(pos in confine))
				continue;
			deltas.forEach(function(delta) {
				var pos1=geometry.Graph(pos,delta);
				if(pos1!=null && (!confine || (pos1 in confine))) 
					graph[pos].push($this.cbTypedArray([pos1 | flags]));								
			});
		}
		return graph;
	}
	
	Model.Game.cbLongRangeGraph = function(geometry,deltas,confine,flags,maxDist) {
		var $this=this;
		if(flags===undefined || flags==null)
			flags=FLAG_MOVE | FLAG_CAPTURE;
		if(!maxDist)
			maxDist=Infinity;
		var graph={};
		for(var pos=0;pos<geometry.boardSize;pos++) {
			graph[pos]=[];
			if(confine && !(pos in confine))
				continue;
			deltas.forEach(function(delta) {
				var direction=[];
				var pos1=geometry.Graph(pos,delta);
				var dist=0;
				while(pos1!=null) {
					if(confine && !(pos1 in confine))
						break;
					direction.push(pos1 | flags);
					if(++dist==maxDist)
						break;
					pos1=geometry.Graph(pos1,delta);
				}
				if(direction.length>0)
					graph[pos].push($this.cbTypedArray(direction));
			});
		}
		return graph;
	}
	
	Model.Game.cbNullGraph = function(geometry) {
		var graph={};
		for(var pos=0;pos<geometry.boardSize;pos++)
			graph[pos]=[];
		return graph;
	}
	
	Model.Game.cbAuthorGraph = function(geometry) {
		var graph={};
		for(var pos=0;pos<geometry.boardSize;pos++) {
			graph[pos]=[];
			for(var pos1=0;pos1<geometry.boardSize;pos1++)
				graph[pos].push([pos1|FLAG_MOVE|FLAG_CAPTURE|FLAG_CAPTURE_NO_KING])
		}
		return graph;
	}
	
	Model.Game.cbMergeGraphs = function(geometry) {
		var graph = [];
		for(var pos=0;pos<geometry.boardSize;pos++) {
			graph[pos] = [];
			for(var i=1;i<arguments.length;i++)
				graph[pos] = graph[pos].concat(arguments[i][pos]);
		}
		return graph;
	}

	Model.Game.cbGetThreatGraph = function() {
		var $this=this;
		
		this.cbUseScreenCapture=false;
		this.cbUseCaptureKing=false;
		this.cbUseCaptureNoKing=false;
		var threatGraph={
			'1': [],
			'-1': [],
		};

		var lines=[];
		for(var pos=0;pos<this.g.boardSize;pos++) {
			this.g.pTypes.forEach(function(pType,typeName) {
				pType.graph[pos].forEach(function(line1) {
					var line=[];
					for(var i=0;i<line1.length;i++) {
						var tg1=line1[i];
						if(tg1 & FLAG_CAPTURE_KING) {
							$this.cbUseCaptureKing=true;
							line.unshift({d:tg1 & MASK,a:pos,tk:typeName});
						} else if(tg1 & FLAG_CAPTURE_NO_KING) {
							$this.cbUseCaptureNoKing=true;
							line.unshift({d:tg1 & MASK,a:pos,tnk:typeName});
						} else if(tg1 & FLAG_CAPTURE)
							line.unshift({d:tg1 & MASK,a:pos,t:typeName});
						else if(tg1 & FLAG_STOP)
							line.unshift({d:tg1 & MASK,a:pos});
						else if(tg1 & FLAG_SCREEN_CAPTURE) {
							$this.cbUseScreenCapture=true;
							line.unshift({d:tg1 & MASK,a:pos,ts:typeName});
						}
					}
					if(line.length>0)
						lines.push(line);
				});
			});
		}

		var allAttackers={};

		lines.forEach(function(line) {
			line.forEach(function(lineItem,lineIndex) {
				var attackers=allAttackers[lineItem.d];
				if(attackers===undefined) {
					attackers={};
					allAttackers[lineItem.d]=attackers;
				}
				var poss=[];
				for(var i=lineIndex+1;i<line.length;i++)
					poss.push(line[i].d);
				poss.push(lineItem.a);
				var key=poss.join(",");
				var att0=attackers[key];
				if(att0===undefined) {
					att0={
						p: poss,
						t: {},
						ts: {},
						tk: {},
					}
					attackers[key]=att0;
				}
				if(lineItem.t!==undefined)
					att0.t[lineItem.t]=true;
				else if(lineItem.tk!==undefined)
					att0.tk[lineItem.tk]=true;
				else if(lineItem.ts!==undefined)
					att0.ts[lineItem.ts]=true;
			});
		});
		
		for(var pos=0;pos<$this.g.boardSize;pos++) {
			var attackers=allAttackers[pos];
			
			function Compact(tree,base) {
				for(var i in attackers) {
					var attacker=attackers[i];
					if(attacker.p.length<base.length+1)
						continue;
					var candidate=true;
					for(var j=0;j<base.length;j++)
						if(base[j]!=attacker.p[j]) {
							candidate=false;
							break;
						}
					if(!candidate)
						continue;
					var nextPos=attacker.p[base.length];
					var nextBranch=tree[nextPos];
					if(nextBranch===undefined) {
						nextBranch={e:{}};
						tree[nextPos]=nextBranch;
					}
					if(attacker.p.length==base.length+1) {
						nextBranch.t=attacker.t;
						nextBranch.ts=attacker.ts;
						nextBranch.tk=attacker.tk;
						delete attackers[i];
					}
					//Compact(nextBranch.e,base.concat([nextPos]));
					base.push(nextPos);
					Compact(nextBranch.e,base);
					base.pop();
				}
			}
			var tree={};
			Compact(tree,[]);
			
			threatGraph[1][pos]=tree;
			threatGraph[-1][pos]=tree;
		}

		return threatGraph;
	}
	
	Model.Game.InitGame = function() {
		var $this=this;
		this.cbVar = cbVar = this.cbDefine();
		
		this.g.boardSize = this.cbVar.geometry.boardSize;

		this.g.pTypes = this.cbGetPieceTypes();
		this.g.threatGraph = this.cbGetThreatGraph();
		this.g.distGraph = this.cbVar.geometry.GetDistances();
		
		this.cbPiecesCount = 0;
		
		this.g.castleablePiecesCount = { '1': 0, '-1': 0 };
		for(var i in cbVar.pieceTypes) {
			var pType=cbVar.pieceTypes[i];
			if(pType.castle) {
				var initial=pType.initial || [];
				initial.forEach(function(iniPiece) {
					$this.g.castleablePiecesCount[iniPiece.s]++;
				});
			}
			if(pType.initial)
				this.cbPiecesCount += pType.initial.length; 
		}

		var boardValues=[];
		for(var i=0;i<this.cbPiecesCount;i++) 
			boardValues.push(i);
		var typeValues = Object.keys(cbVar.pieceTypes);
		this.zobrist=new JocGame.Zobrist({
			board: {
				type: "array",
				size: this.cbVar.geometry.boardSize,
				values: boardValues,
			},
			who: {
				values: ["1","-1"],			
			},
			type: {
				type: "array",
				size: this.cbPiecesCount,
				values: typeValues
			}
		});	
		
	}
	
	Model.Game.cbGetPieceTypes = function() {
		//var $this=this;
	
		var pTypes = [];
		
		var nullGraph = {};
		for(var pos=0;pos<this.cbVar.geometry.boardSize;pos++)
			nullGraph[pos]=[];
		
		for(var typeIndex in this.cbVar.pieceTypes) {
			var pType = this.cbVar.pieceTypes[typeIndex];
			pTypes[typeIndex] = {
				graph: pType.graph || nullGraph,
				abbrev: pType.abbrev || '',
				value: pType.isKing?100:(pType.value || 1),
				isKing: !!pType.isKing,
				castle: !!pType.castle,
				epTarget: !!pType.epTarget,
				epCatch: !!pType.epCatch,
			}
		}
		
		return pTypes;
	}

	Model.Board.Init = function(aGame) {
		this.zSign=0;
	}

	Model.Board.InitialPosition = function(aGame) {
		var $this=this;
		if(USE_TYPED_ARRAYS)
			this.board=new Int16Array(aGame.g.boardSize);
		else
			this.board=[];
		for(var pos=0;pos<aGame.g.boardSize;pos++)
			this.board[pos]=-1;
		this.kings={};
		this.pieces=[];
		this.ending={
			'1': false,
			'-1': false,
		}
		this.lastMove=null;
		if(aGame.cbVar.castle)
			this.castled={
				'1': false,
				'-1': false,
			}
		this.zSign=aGame.zobrist.update(0,"who",-1);

		this.noCaptCount = 0;
		this.mWho = 1;

		if(aGame.mInitial) {
			this.mWho = aGame.mInitial.turn || 1;
			aGame.mInitial.pieces.forEach(function(piece) {
				var piece1={}
				for(var f in piece)
					if(piece.hasOwnProperty(f))
						piece1[f]=piece[f];
				$this.pieces.push(piece1);
			});
			if(aGame.mInitial.lastMove)
				this.lastMove={
					f: aGame.mInitial.lastMove.f,
					t: aGame.mInitial.lastMove.t,
				}
			if(aGame.mInitial.noCaptCount!==undefined)
				this.noCaptCount=aGame.mInitial.noCaptCount;
			if(aGame.cbVar.castle && aGame.mInitial.castle)
				this.castled = {
					'1': {
						k: !!aGame.mInitial.castle[1] && !!aGame.mInitial.castle[1].k,
						q: !!aGame.mInitial.castle[1] && !!aGame.mInitial.castle[1].q
					},
					'-1': {
						k: !!aGame.mInitial.castle[-1] && !!aGame.mInitial.castle[-1].k,
						q: !!aGame.mInitial.castle[-1] && !!aGame.mInitial.castle[-1].q
					}
				}
		} else {
			for(var typeIndex in aGame.cbVar.pieceTypes) {
				var pType = aGame.cbVar.pieceTypes[typeIndex];
				var initial = pType.initial || [];
				for(var i=0;i<initial.length;i++) {
					var desc = initial[i];
					var piece = {
						s: desc.s,
						t: parseInt(typeIndex),
						p: desc.p,
						m: false,
					}
					this.pieces.push(piece);
				}
			}
		}
		
		this.pieces.sort(function(p1,p2) {
			if(p1.s!=p2.s)
				return p2.s-p1.s;
			var v1=aGame.cbVar.pieceTypes[p1.t].value || 100;
			var v2=aGame.cbVar.pieceTypes[p2.t].value || 100;
			if(v1!=v2)
				return v1-v2;
			return p1.p-p2.p;
		});

		this.pieces.forEach(function(piece,index) {
			piece.i=index;
			$this.board[piece.p]=index;
			var pType=aGame.g.pTypes[piece.t];
			if(pType.isKing)
				$this.kings[piece.s]=piece.p;
			$this.zSign=aGame.zobrist.update($this.zSign,"board",index,piece.p);
			$this.zSign=aGame.zobrist.update($this.zSign,"type",piece.t,index);
		});
		
		//console.log("sign",this.zSign);
		
		if(aGame.mInitial && aGame.mInitial.enPassant) {
			var pos=cbVar.geometry.PosByName(aGame.mInitial.enPassant);
			if(pos>=0) {
				var pos2;
				// TODO does not work for all geometries
				var c=cbVar.geometry.C(pos);
				var r=cbVar.geometry.R(pos);
				if(aGame.mInitial.turn==1)
					pos2=cbVar.geometry.POS(c,r-1);
				else
					pos2=cbVar.geometry.POS(c,r+1);
				this.epTarget={
					p: pos,
					i: this.board[pos2],
				}
			}
		}
	}

	Model.Board.CopyFrom = function(aBoard) {
		if(USE_TYPED_ARRAYS) {
			this.board=new Int16Array(aBoard.board.length);
			this.board.set(aBoard.board);
		} else {
			this.board=[];
			var board0=aBoard.board;
			var boardLength=board0.length;
			for(var i=0;i<boardLength;i++)
				this.board.push(board0[i]);
		}
		this.pieces=[];
		var piecesLength=aBoard.pieces.length;
		for(var i=0;i<piecesLength;i++) {
			var piece=aBoard.pieces[i];
			this.pieces.push({
				s: piece.s,
				p: piece.p,
				t: piece.t,
				i: piece.i,
				m: piece.m,
			});
		}
		this.kings={
			'1': aBoard.kings[1],
			'-1': aBoard.kings[-1],
		}
		this.check=aBoard.check;
		if(aBoard.lastMove)
			this.lastMove={
				f: aBoard.lastMove.f,
				t: aBoard.lastMove.t,
				c: aBoard.lastMove.c,
			}
		else
			this.lastMove=null;
		this.ending={
			'1': aBoard.ending[1],
			'-1': aBoard.ending[-1],
		}
		if(aBoard.castled!==undefined) {
			this.castled= {
				'1': aBoard.castled[1],
				'-1': aBoard.castled[-1],
			}
		}
		this.noCaptCount=aBoard.noCaptCount;
		if(aBoard.epTarget)
			this.epTarget={
				p: aBoard.epTarget.p,
				i: aBoard.epTarget.i,
			}
		else
			this.epTarget=null;
		this.mWho=aBoard.mWho;
		this.zSign=aBoard.zSign;
	}

	Model.Board.cbApplyCastle = function(aGame,move,updateSign) {
		var spec=aGame.cbVar.castle[move.f+"/"+move.cg];
		var rookTo=spec.r[spec.r.length-1];
		var rPiece=this.pieces[this.board[move.cg]];
		var kingTo=spec.k[spec.k.length-1];
		var kPiece=this.pieces[this.board[move.f]];
		if(updateSign) {
			this.zSign=aGame.zobrist.update(this.zSign,"board",rPiece.i,move.cg);
			this.zSign=aGame.zobrist.update(this.zSign,"board",rPiece.i,rookTo);
			this.zSign=aGame.zobrist.update(this.zSign,"board",kPiece.i,move.f);
			this.zSign=aGame.zobrist.update(this.zSign,"board",kPiece.i,kingTo);
		}
		
		rPiece.p=rookTo;
		rPiece.m=true;
		this.board[move.cg]=-1;
		
		kPiece.p=kingTo;
		kPiece.m=true;
		this.board[move.f]=-1;
		
		this.board[rookTo]=rPiece.i;
		this.board[kingTo]=kPiece.i;
		this.castled[rPiece.s]=true;
		
		this.kings[kPiece.s]=kingTo;
		
		return [{
			i: rPiece.i,
			f: rookTo,
			t: -1,
		},{
			i: kPiece.i,
			f: kingTo,
			t: move.f,
			kp: move.f,
			who: kPiece.s,
			m: false,
		},{
			i: rPiece.i,
			f: -1,
			t: move.cg,
			m: false,
			cg: false,
		}];
	}
	
	Model.Board.cbQuickApply = function(aGame,move) {
		if(move.cg!==undefined)
			return this.cbApplyCastle(aGame,move,false);

		var undo=[];
		var index=this.board[move.f];
		var piece=this.pieces[index];
		if(move.c!=null) {
			undo.unshift({
				i: move.c,
				f: -1,
				t: this.pieces[move.c].p,
			});
			var piece1=this.pieces[move.c];
			this.board[piece1.p]=-1;
			piece1.p=-1;
		}
		var kp=this.kings[piece.s];
		if(aGame.g.pTypes[piece.t].isKing)
			this.kings[piece.s]=move.t;
		undo.unshift({
			i: index,
			f: move.t,
			t: move.f,
			kp: kp,
			who: piece.s,
			ty: piece.t,
		});
		piece.p=move.t;
		if(move.pr!==undefined)
			piece.t=move.pr;
		this.board[move.f]=-1;
		this.board[move.t]=index;

		return undo;
	}

	Model.Board.cbQuickUnapply = function(aGame,undo) {
		for(var i=0;i<undo.length;i++) {
			var u=undo[i];
			var piece=this.pieces[u.i];
			if(u.f>=0) {
				piece.p=-1;
				this.board[u.f]=-1;
			}
			if(u.t>=0) {
				piece.p=u.t;
				this.board[u.t]=u.i;
			}
			if(u.m!==undefined)
				piece.m=u.m;
			if(u.kp!==undefined)
				this.kings[u.who]=u.kp;
			if(u.ty!=undefined)
				piece.t=u.ty;
			if(u.cg!=undefined)
				this.castled[piece.s]=u.cg;
		}
	}

	Model.Board.ApplyMove = function(aGame,move) {
		var piece=this.pieces[this.board[move.f]];
		if(move.cg!==undefined)
			this.cbApplyCastle(aGame,move,true);
		else {
			this.zSign=aGame.zobrist.update(this.zSign,"board",piece.i,move.f);
			this.board[piece.p]=-1;
			if(move.pr!==undefined) {
				this.zSign=aGame.zobrist.update(this.zSign,"type",piece.t,piece.i);
				piece.t=move.pr;
				this.zSign=aGame.zobrist.update(this.zSign,"type",piece.t,piece.i);
			}
			if(move.c!=null) {
				var piece1=this.pieces[move.c];
				this.zSign=aGame.zobrist.update(this.zSign,"board",piece1.i,piece1.p);
				this.board[piece1.p]=-1;
				piece1.p=-1;
				piece1.m=true;
				this.noCaptCount=0;
			} else 
				this.noCaptCount++;
			piece.p=move.t;
			piece.m=true;
			this.board[move.t]=piece.i;
			this.zSign=aGame.zobrist.update(this.zSign,"board",piece.i,move.t);
			if(aGame.g.pTypes[piece.t].isKing)
				this.kings[piece.s]=move.t;
		}
		this.check=!!move.ck;
		this.lastMove={
			f: move.f,
			t: move.t,
			c: move.c,
		}
		if(move.ko!==undefined)
			this.ending[piece.s]=move.ko;
		if(move.ept!==undefined)
			this.epTarget={
				p: move.ept,
				i: piece.i,
			}
		else
			this.epTarget=null;
		this.zSign=aGame.zobrist.update(this.zSign,"who",-this.mWho);
		this.zSign=aGame.zobrist.update(this.zSign,"who",this.mWho);	
		//this.cbIntegrity(aGame);
	}

	Model.Board.Evaluate = function(aGame) {
		var debug=arguments[3]=="debug";
		var $this=this;
		this.mEvaluation=0;
		var who=this.mWho;
		var g=aGame.g;
		var material;
		if(USE_TYPED_ARRAYS)
			material={ 
				'1': {
					count: new Uint8Array(g.pTypes.length),
					byType: {},
				},
				'-1': {
					count: new Uint8Array(g.pTypes.length), 
					byType: {},
				}
			}
		else {
			material={ 
				'1': {
					count: [],
					byType: {},
				},
				'-1': {
					count: [], 
					byType: {},
				}
			}
			for(var i=0;i<g.pTypes.length;i++)
				material["1"].count[i]=material["-1"].count[i]=0;
		}
		
		if(aGame.mOptions.preventRepeat && aGame.GetRepeatOccurence(this)>2) {
			this.mFinished=true;
			this.mWinner=aGame.cbOnPerpetual?who*aGame.cbOnPerpetual:JocGame.DRAW;
			return;
		}
		
		var pieceValue={ '1': 0, '-1': 0 };
		var distKingGraph={
			'1': g.distGraph[this.kings[-1]],
			'-1': g.distGraph[this.kings[1]],
		}
		var distKing={ '1': 0, '-1': 0 };
		var pieceCount={ '1': 0, '-1': 0 };
		var posValue={ '1': 0, '-1': 0 };
		
		var castlePiecesCount={ '1': 0, '-1': 0 };
		var kingMoved={ '1': false, '-1': false };
		
		var pieces=this.pieces;
		var piecesLength=pieces.length;
		for(var i=0;i<piecesLength;i++) {
			var piece=pieces[i];
			if(piece.p>=0) {
				var s=piece.s;
				var pType=g.pTypes[piece.t];
				if(!pType.isKing)
					pieceValue[s]+=pType.value;
				else
					kingMoved[s]=piece.m;
				if(pType.castle && !piece.m)
					castlePiecesCount[s]++;
				pieceCount[s]++;
				distKing[s]+=distKingGraph[s][piece.p];
				posValue[s]+=cbVar.geometry.distEdge[piece.p];
				var mat=material[s];
				mat.count[piece.t]++;
				var byType=mat.byType;
				if(byType[piece.t]===undefined)
					byType[piece.t]=[piece];
				else
					byType[piece.t].push(piece);					
			}
		}
		
		if(this.lastMove && this.lastMove.c!=null) {
			var piece=this.pieces[this.board[this.lastMove.t]];
			pieceValue[-piece.s]+=this.cbStaticExchangeEval(aGame,piece.p,piece.s,{piece:piece})
		}
		var kingFreedom={ '1': 0, '-1': 0 };
		var endingDistKing={ '1': 0, '-1': 0 };
		var distKingCorner={ '1': 0, '-1': 0 };
		function DistKingCorner(side) {
			var dist=Infinity;
			for(var corner in cbVar.geometry.corners) 
				dist=Math.min(dist,g.distGraph[$this.kings[side]][corner]);
			return dist-Math.sqrt(g.boardSize);
		}
		if(this.ending[1]) {
			//kingFreedom[1]=this.cbEvaluateKingFreedom(aGame,1)-g.boardSize;
			//endingDistKing[1]=g.distGraph[this.kings[-1]][this.kings[1]]-Math.sqrt(g.boardSize);
			endingDistKing[1]=(distKing['1']-Math.sqrt(g.boardSize))/pieceCount['1'];
			if(cbVar.geometry.corners)
				distKingCorner[1]=DistKingCorner(1);
		}
		if(this.ending[-1]) {
			//kingFreedom[-1]=this.cbEvaluateKingFreedom(aGame,-1)-g.boardSize;
			//endingDistKing[-1]=g.distGraph[this.kings[-1]][this.kings[1]]-Math.sqrt(g.boardSize);
			endingDistKing[-1]=(distKing['-1']-Math.sqrt(g.boardSize))/pieceCount['-1'];
			if(cbVar.geometry.corners)
				distKingCorner[1]=DistKingCorner(-1);
		}
		
		var evalValues={
			"pieceValue": pieceValue['1']-pieceValue[-1],
			"pieceValueRatio": (pieceValue['1']-pieceValue[-1])/(pieceValue['1']+pieceValue['-1']+1),
			"posValue": posValue['1']-posValue[-1],
			"averageDistKing": distKing['1']/pieceCount['1']-distKing['-1']/pieceCount[-1],
			"check": this.check?-who:0,
			"endingKingFreedom": kingFreedom[1]-kingFreedom[-1],
			"endingDistKing": endingDistKing['1']-endingDistKing['-1'],
			"distKingCorner": distKingCorner['1']-distKingCorner['-1'],
		}
		if(cbVar.castle)
			evalValues["castle"] = 
				(this.castled[1] ? 1 : (kingMoved[1]? 0 : castlePiecesCount[1] / (g.castleablePiecesCount[1]+1))) -  
				(this.castled[-1] ? 1 : (kingMoved[-1]? 0 : castlePiecesCount[-1] / (g.castleablePiecesCount[-1]+1)));
		
		if(cbVar.evaluate)
			cbVar.evaluate.call(this,aGame,evalValues,material);

		var evParams=aGame.mOptions.levelOptions;
		for(var name in evalValues) {
			var value=evalValues[name];
			var factor=evParams[name+'Factor'] || 0;
			var weighted=value*factor;
			if(debug)
				console.log(name,"=",value,"*",factor,"=>",weighted);
			this.mEvaluation+=weighted;
		}
		if(debug)
			console.log("Evaluation",this.mEvaluation);
	}
	
	Model.Board.cbGeneratePseudoLegalMoves = function(aGame) {
		var $this=this;
		var moves=[];
		var cbVar=aGame.cbVar;
		var who=this.mWho;
		var castlePieces=cbVar.castle && !this.check && !this.castled[who]?[]:null; // consider castle ?
		var king=-1;
		
		function PromotedMoves(piece,move) {
			var promoFnt=aGame.cbVar.promote;
			if(!promoFnt) {
				moves.push(move);
				return;
			}
			var promo=promoFnt.call($this,aGame,piece,move);
			if(promo==null)
				return;
			if(promo.length==0)
				moves.push(move);
			else if(promo.length==1) {
				move.pr=promo[0];
				moves.push(move);
			} else {
				for(var i=0;i<promo.length;i++) {
					var pr=promo[i];
					moves.push({
						f: move.f,
						t: move.t,
						c: move.c,
						pr: pr,
						ept: move.ept,
						ep: move.ep,
						a: move.a,
					});
				}
			}
		}

		var piecesLength=this.pieces.length;
		for(var i=0;i<piecesLength;i++) {
			var piece=this.pieces[i];
			if(piece.p<0 || piece.s!=who)
				continue;
			var pType=aGame.g.pTypes[piece.t];
			
			if(pType.isKing) {
				if(piece.m) // king moved, no castling
					castlePieces=null;
				else
					king=piece;
			}
			if(castlePieces && pType.castle && !piece.m) // rook considered for castle
				castlePieces.push(piece);
			
			var graph, graphLength;
			graph=pType.graph[piece.p];
			graphLength=graph.length;
			for(var j=0;j<graphLength;j++) {
				var line=graph[j];
				var screen=false;
				var lineLength=line.length;
				var lastPos=null;
				for(var k=0;k<lineLength;k++) {
					var tg1=line[k];
					var pos1=tg1 & MASK;
					var index1=this.board[pos1];
					if(index1<0 && (!pType.epCatch || !this.epTarget || this.epTarget.p!=pos1)) {
						if((tg1 & FLAG_MOVE) && screen==false)
							PromotedMoves(piece,{
								f: piece.p,
								t: pos1,
								c: null,
								a: pType.abbrev,
								ept: lastPos==null || !pType.epTarget?undefined:lastPos,
							});
					} else if(tg1 & FLAG_SCREEN_CAPTURE) {
						if(screen) {
							var piece1=this.pieces[index1];
							if(piece1.s!=piece.s)
								PromotedMoves(piece,{
									f: piece.p,
									t: pos1,
									c: piece1.i,
									a: pType.abbrev,
								});
							break;
						} else
							screen=true;
					} else {
						var piece1;
						if(index1<0)
							piece1=this.pieces[this.epTarget.i];
						else
							piece1=this.pieces[index1];
						if(piece1.s!=piece.s && (tg1 & FLAG_CAPTURE) && (!(tg1 & FLAG_CAPTURE_KING) || aGame.g.pTypes[piece1.t].isKing) &&
								(!(tg1 & FLAG_CAPTURE_NO_KING) || !aGame.g.pTypes[piece1.t].isKing))
							PromotedMoves(piece,{
								f: piece.p,
								t: pos1,
								c: piece1.i,
								a: pType.abbrev,
								ep: index1<0,
							});
						break;
					}
					lastPos=pos1;
				}
			}
		}
		
		if(castlePieces) {
			for(var i=0;i<castlePieces.length;i++) {
				var rook=castlePieces[i];
				var spec=aGame.cbVar.castle[king.p+"/"+rook.p];
				if(!spec)
					continue;
				var rookOk=true;
				for(var j=0;j<spec.r.length;j++) {
					var pos=spec.r[j];
					if(this.board[pos]>=0 && pos!=king.p && pos!=rook.p) {
						rookOk=false;
						break;
					}
				}
				if(rookOk) {
					var kingOk=true;
					for(var j=0;j<spec.k.length;j++) {
						var pos=spec.k[j];
						if((this.board[pos]>=0 && pos!=rook.p && pos!=king.p) || this.cbGetAttackers(aGame,pos,who).length>0) {
							kingOk=false;
							break;
						}
					}
					if(kingOk) {
						moves.push({
							f: king.p,
							t: spec.k[spec.k.length-1],
							c: null,
							cg: rook.p,
						});
					}
				}
			}
		}
		
		return moves;
	}
	
	// Static Exchange Evaluation, as per http://chessprogramming.wikispaces.com/Static+Exchange+Evaluation
	Model.Board.cbStaticExchangeEval = function(aGame,pos,side,lastCaptured) {
		var value=0;
		var piece1=this.cbGetSmallestAttacker(aGame,pos,side);
		if(piece1) {
			var who=this.mWho;
			this.mWho=piece1.s;
			var undo=this.cbQuickApply(aGame,{
				f: piece1.p,
				t: pos,
				c: lastCaptured.piece.i,
			});
			var lastCapturedValue=aGame.g.pTypes[lastCaptured.piece.t].value;
			lastCaptured.piece=piece1;
			value=Math.max(0,lastCapturedValue-this.cbStaticExchangeEval(aGame,pos,-side,lastCaptured));
			this.cbQuickUnapply(aGame,undo);
			//this.cbIntegrity(aGame);
			this.mWho=who;
		}
		return value;		
	}
	
	Model.Board.cbGetSmallestAttacker = function(aGame,pos,side) {
		var attackers=this.cbGetAttackers(aGame,pos,side);
		if(attackers.length==0)
			return null;
		var smallestValue=Infinity;
		var smallestAttacker=null;
		var attackersLength=attackers.length;
		for(var i=0;i<attackersLength;i++) {
			var attacker=attackers[i];
			var attackerValue=aGame.g.pTypes[attacker.t].value;
			if(attackerValue<smallestValue) {
				smallestValue=attackerValue;
				smallestAttacker=attacker;
			} 
		}
		return smallestAttacker;
	}

	Model.Board.cbCollectAttackers=function(who,graph,attackers,isKing) {
		for(var pos1 in graph) {
			var branch=graph[pos1];
			var index1=this.board[pos1];
			if(index1<0)
				this.cbCollectAttackers(who,branch.e,attackers,isKing);
			else {
				var piece1=this.pieces[index1];
				if(piece1.s==-who && (
						(branch.t && (piece1.t in branch.t)) ||
						(isKing && branch.tk && (piece1.t in branch.tk))))
					attackers.push(piece1);
			}
		}
	}

	Model.Board.cbCollectAttackersScreen=function(who,graph,attackers,isKing,screen) {
		for(var pos1 in graph) {
			var branch=graph[pos1];
			var index1=this.board[pos1];
			if(index1<0)
				this.cbCollectAttackersScreen(who,branch.e,attackers,isKing,screen);
			else {
				var piece1=this.pieces[index1];
				if(!screen && piece1.s==-who && (
						(branch.t && (piece1.t in branch.t)) ||
						(isKing && branch.tk && (piece1.t in branch.tk))))
					attackers.push(piece1);
				else if(!screen)
					this.cbCollectAttackersScreen(who,branch.e,attackers,isKing,true);
				else if(screen && piece1.s==-who && branch.ts && (piece1.t in branch.ts))
					attackers.push(piece1);
			}
		}
	}

	Model.Board.cbGetAttackers = function(aGame,pos,who,isKing) {
		var attackers=[];
		if(aGame.cbUseScreenCapture)
			this.cbCollectAttackersScreen(who,aGame.g.threatGraph[who][pos],attackers,isKing,false);
		else
			this.cbCollectAttackers(who,aGame.g.threatGraph[who][pos],attackers,isKing);
		return attackers;
	}

	Model.Board.GenerateMoves = function(aGame) {
		var moves=this.cbGeneratePseudoLegalMoves(aGame);
		this.mMoves = [];
		var kingOnly=true;
		var selfKingPos=this.kings[this.mWho];
		var movesLength=moves.length;
		for(var i=0;i<movesLength;i++) {
			var move=moves[i];
			var undo=this.cbQuickApply(aGame,move);
			var inCheck=this.cbGetAttackers(aGame,this.kings[this.mWho],this.mWho,true).length>0;
			if(!inCheck) {
				var oppInCheck=this.cbGetAttackers(aGame,this.kings[-this.mWho],-this.mWho,true).length>0;
				move.ck = oppInCheck; 
				this.mMoves.push(move);
				if(move.f!=selfKingPos)
					kingOnly=false;
			}
			this.cbQuickUnapply(aGame,undo);
		}
		if(this.mMoves.length==0) {
			this.mFinished=true;
			this.mWinner=aGame.cbOnStaleMate?aGame.cbOnStaleMate*this.mWho:JocGame.DRAW;
			if(this.check)
				this.mWinner=-this.mWho;
		} else if(this.ending[this.mWho]) {
			if(!kingOnly) {
				for(var i=0;i<this.mMoves.length;i++)
					this.mMoves[i].ko=false;
			}
		} else if(!this.ending[this.mWho]) {
			if(kingOnly && !this.check) {
				for(var i=0;i<this.mMoves.length;i++)
					this.mMoves[i].ko=true;
			}
		}
	}

	Model.Board.GetSignature = function() {
		return this.zSign;
	}

	Model.Move.Init = function(args) {
		for(var f in args)
			if(args.hasOwnProperty(f))
				this[f]=args[f];
	}

	Model.Move.Equals = function(move) {
		return this.f==move.f && this.t==move.t && this.pr==move.pr;
	}
	
	Model.Move.CopyFrom=function(move) {
		this.Init(move);
	}

	Model.Move.ToString = function(format) {

		var self = this;
		format = format || "natural";

		// not sure was that was for...
		//if(this.compact)
		//	return this.compact;
		function NaturalFormat() {
			var str;
			if(self.cg!==undefined) {
				str=cbVar.castle[self.f+"/"+self.cg].n;
			} else {
				str=self.a || '';
				str+=cbVar.geometry.PosName(self.f);
				if(self.c==null)
					str+="-";
				else
					str+="x";
				str+=cbVar.geometry.PosName(self.t);
			}
			if(self.pr!==undefined) {
				var pType=cbVar.pieceTypes[self.pr];
				if(pType && pType.abbrev && pType.abbrev.length>0 && !pType.silentPromo)
					str+="="+pType.abbrev;
			}
			if(self.ck)
				str+="+";
			return str;
		}

		function EngineFormat() {
			var str = cbVar.geometry.PosName(self.f) + cbVar.geometry.PosName(self.t);
			if(self.pr!=undefined) {
				var pType=cbVar.pieceTypes[self.pr];
				if(pType && pType.abbrev && pType.abbrev.length>0 && !pType.silentPromo)
					str+=pType.abbrev;				
			}
			return str;
		}
		
		switch(format) {
			case "natural":
				return NaturalFormat();
			case "engine":
				return EngineFormat();
			default:
				return "??";
		}


	}
	
	/* compact the move notation while preventing ambiguities */
	Model.Board.CompactMoveString = function(aGame,aMove,allMoves) {
		if(typeof aMove.ToString!="function") // ensure proper move object, if necessary
			aMove=aGame.CreateMove(aMove);
		var moveStr=aMove.ToString();
		var m=/^([A-Z]?)([a-z])([1-9][0-9]*)([-x])([a-z])([1-9][0-9]*)(.*?)$/.exec(moveStr);
		if(!m)
			return moveStr;
		var moveSuffix=m[7];

		if(!allMoves)
			allMoves={};
		if(!allMoves.value)
			allMoves.value=[];
		if(allMoves.value.length==0) {
			var oldMoves=this.mMoves;
			if(!this.mMoves || this.mMoves.length==0)
				this.GenerateMoves(aGame);
			for(var i=0;i<this.mMoves.length;i++) {
				var move=this.mMoves[i];
				if(typeof move.ToString!="function") // ensure proper move object, if necessary
					move=aGame.CreateMove(move);
				allMoves.value.push({
					str: move.ToString(),
					move: move,
				});
			}
			this.mMoves=oldMoves;
		}
		var matching=[];
		allMoves.value.forEach(function(mv) {
			var m2=/^([A-Z]?[a-z][1-9][0-9]*[-x][a-z][1-9][0-9]*)(.*?)$/.exec(mv.str);
			if(m2) {
				if(mv.move.t==aMove.t && (mv.move.a || '')==m[1] && m2[2]==moveSuffix) {
					matching.push(mv.move);
				}
			}			
		});

		if(matching.length==1) {
			if(m[1]=='' && m[4]=='x')
				return m[2]+'x'+m[5]+m[6]+m[7];
			else
				return m[1]+(m[4]=='x'?'x':'')+m[5]+m[6]+m[7];
		}
		if(cbVar.geometry.CompactCrit) {
			var crit="";
			for(var i=0;;i++) {
				var from2=cbVar.geometry.CompactCrit(aMove.f,i);
				if(from2==null)
					return moveStr;
				crit+=from2;
				var matching2=[];
				for(var j=0;j<matching.length;j++) {
					var move2=matching[j];
					if(cbVar.geometry.CompactCrit(move2.f,i)==from2)
						matching2.push(move2);
				}

				console.assert(matching2.length>0);
				if(matching2.length==1)
					return m[1]+crit+(m[4]=='x'?'x':'')+m[5]+m[6]+m[7];
				matching=matching2;
			}
		}
		return moveStr;
	}
	
	Model.Board.cbIntegrity = function(aGame) {
		var $this=this;
		function Assert(cond,text) {
			if(!cond) {
				console.error(text);
				debugger;
			}
		}
		for(var pos=0;pos<this.board.length;pos++) {
			var index=this.board[pos];
			if(index>=0) {
				var piece=$this.pieces[index];
				Assert(piece!==undefined,"no piece at pos");
				Assert(piece.p==pos,"piece has different pos");
			}
		}
		for(var index=0;index<this.pieces.length;index++) {
			var piece=this.pieces[index];
			if(piece.p>=0) {
				Assert($this.board[piece.p]==index,"board index mismatch");
			}
		}
	}

	Model.Board.ExportBoardState = function(aGame) {
		if(!aGame.cbVar.geometry.ExportBoardState)
			return "not supported";
		return aGame.cbVar.geometry.ExportBoardState(this,aGame.cbVar,aGame.mPlayedMoves.length);
	}

	Model.Game.Import = function(format,data) {
		var turn, pieces=[], castle={'1':{},'-1':{}}, enPassant=null, noCaptCount=0;

		if(format=='pjn') {
			var result={
				status: false,
				error: 'parse',
			}
			var fenParts=data.split(' ');
			if(fenParts.length!=6) {
				console.warn("FEN should have 6 parts");
				return result;
			}
			var fenRows=fenParts[0].split('/');
			var fenHeight = cbVar.geometry.fenHeight || cbVar.geometry.height;
			if(fenRows.length!=fenHeight) {
				console.warn("FEN board should have",fenHeight,"rows, got",fenRows.length);
				return result;
			}
			
			var piecesMap={}
			
			for(var index in cbVar.pieceTypes) {
				var pType=cbVar.pieceTypes[index];
				var abbrev=pType.fenAbbrev || pType.abbrev || 'X';
				piecesMap[abbrev.toUpperCase()]={
					s: 1,
					t: index,
				}
				piecesMap[abbrev.toLowerCase()]={
					s: -1,
					t: index,
				}
			}
			
			var FenRowPos = cbVar.geometry.FenRowPos || function(rowIndex,colIndex) {
				return (cbVar.geometry.height-1-rowIndex)*cbVar.geometry.width+colIndex;
			}
			
			// TODO row/col does not fit all geometries
			fenRows.forEach(function(row,rowIndex) {
				var colIndex=0;
				for(var i=0;i<row.length;i++) {
					var ch=row.substr(i,1);
					var pieceDescr=piecesMap[ch];
					if(pieceDescr!==undefined) {
						var pos=FenRowPos(rowIndex,colIndex);
						colIndex++;
						var piece={
							s: pieceDescr.s,
							t: pieceDescr.t,
							p: pos,
						}
						var moved=true;
						var initial1=cbVar.pieceTypes[piece.t].initial || [];
						for(var j=0;j<initial1.length;j++) {
							var desc=initial1[j];
							if(desc.s==piece.s && desc.p==pos)
								moved=false;
						}
						piece.m=moved;
						pieces.push(piece);
					} else if(!isNaN(parseInt(ch))) 
						colIndex+=parseInt(ch);
					else {
						console.warn("FEN invalid board spec",ch);
						return result;
					}
				}
			});
			pieces.sort(function(p1,p2) {
				return p2.s-p1.s;
			});
			if(fenParts[1]=='w')
				turn=1;
			else if(fenParts[1]=='b')
				turn=-1;
			else {
				console.warn("FEN invalid turn spec",fenParts[1]);
				return result;
			}
			castle[1].k=fenParts[2].indexOf('K')>=0;
			castle[1].q=fenParts[2].indexOf('Q')>=0;
			castle[-1].k=fenParts[2].indexOf('k')>=0;
			castle[-1].q=fenParts[2].indexOf('q')>=0;
			enPassant=fenParts[3]=='-'?null:fenParts[3];
			var noCaptCount1=parseInt(fenParts[4]);
			if(!isNaN(noCaptCount1))
				noCaptCount=noCaptCount1;
			
			var initial={
				pieces: pieces,
				turn: turn,
				castle: castle,
				enPassant: enPassant,
				noCaptCount: noCaptCount,
			}
			var status=true;
			if(cbVar.importGame)
				cbVar.importGame.call(this,initial,format,data);
			
			return {
				status: status,
				initial: initial,
			}
		}
		return {
			status: false,
			error: 'unsupported',
		}
	}

	
})();

(function() {
	
	Model.Game.cbBoardGeometrySmess = function(width,height) {
		var $this=this;
		var distance;
		
		function C(pos) {
			return pos%width;
		}
		function R(pos) {
			return Math.floor(pos/width);
		}
		function POS(c,r) {
			return r*width+c;
		}
		function Graph(pos,delta) {
			var c0=C(pos);
			var r0=R(pos);
			var c=c0+delta[0];
			var r=r0+delta[1];
			if(c<0 || c>=width || r<0 || r>=height)
				return null;
			return POS(c,r);
		}
		function PosName(pos) {
			 return String.fromCharCode(("a".charCodeAt(0))+C(pos)) + (R(pos)+1);
		}
		function PosByName(str) {
			var m=/^([a-z])([0-9]+)$/.exec(str);
			if(!m)
				return -1;
			var c=m[1].charCodeAt(0)-"a".charCodeAt(0);
			var r=parseInt(m[2])-1;
			return POS(c,r);
		}
		function CompactCrit(pos,index) {
			if(index==0)
				return String.fromCharCode(("a".charCodeAt(0))+C(pos));
			else if(index==1)
				return (R(pos)+1);
			else
				return null;
		}
		function GetDistances() {
			if(distance!==undefined)
				return distance;
			distance={};
			for(var pos=0;pos<width*height;pos++) {
				distance[pos]={};
				distance[pos][pos]=0;				
			}
			var graphDeltas={
				0:[-1,1],1:[0,1],2:[1,1],3:[1,0],4:[1,-1],5:[0,-1],6:[-1,-1],7:[-1,0],
			}
			var modifs=true;
			while(modifs) {
				modifs=false;
				for(var pos=0;pos<width*height;pos++) {
					var deltas=[];
					for(var i=0;i<8;i++) {
						if($this.cbSmessGraph[pos] & (1<<i))
							deltas.push(graphDeltas[i]);
					}
					deltas.forEach(function(delta) {
						var pos1=Graph(pos,delta);
						if(pos1==null)
							return;
						if(distance[pos][pos1]!=1) {
							distance[pos][pos1]=1;
							modifs=true;
						} 
						for(var pos2=0;pos2<width*height;pos2++) {
							if(pos2==pos)
								continue;
							if(distance[pos][pos2]===undefined && distance[pos1][pos2]!==undefined) {
								distance[pos][pos2]=distance[pos1][pos2]+1;
								modifs=true;
							} else if(distance[pos][pos2]!==undefined && distance[pos1][pos2]!==undefined && distance[pos][pos2]>distance[pos1][pos2]+1) {
								distance[pos][pos2]=distance[pos1][pos2]+1;
								modifs=true;
							}
						}
					});

				}
			}
			return distance;
		}
		function DistPromo() {
			// for each side and position, calculate distance to promotion line
			var distPromo={	"1": {}, "-1": {} };
			var distance = GetDistances();
			["1","-1"].forEach(function(side) {
				for(var pos=0;pos<width*height;pos++) {
					var minDist=Infinity;
					for(var pos1 in $this.cbSmessPromoPoss[side]) {
						var dist=distance[pos][pos1];
						if(dist<minDist) {
							distPromo[side][pos]=dist;
							minDist=dist;
						}
					}
				}		
			});
			return distPromo;
		}
		function DistEdges() {
			var dist=[];
			for(var pos=0;pos<width*height;pos++) {
				var c=C(pos);
				var r=R(pos);
				dist[pos]=Math.min(
					c, Math.abs(width-c-1),
					r, Math.abs(height-r-1)
				);
			}
			return dist;
		}
		function Corners() {
			var corners={};
			corners[POS(0,0)]=1;
			corners[POS(0,height-1)]=1;
			corners[POS(width-1,0)]=1;
			corners[POS(width-1,height-1)]=1;
			return corners;
		}
		
		return {
			boardSize: width*height,
			width: width,
			height: height,
			C: C,
			R: R,
			POS: POS,
			Graph: Graph, 
			PosName: PosName,
			PosByName: PosByName,
			CompactCrit: CompactCrit,
			GetDistances: GetDistances,
			distEdge: DistEdges(),
			corners: Corners(),
			distPromo: DistPromo(),
		};
	}
	
	Model.Game.cbSmessGraph=[
	    2, 128|2|8, 128|2|8, 128|2|8, 128|2|8, 128|2|8, 128|2,
	    2|32, 2|8, 2|8|32|128, 128|2|8, 2|8|32|128, 2|16|128, 2|32,
	    2|8|32, 8|32|128, 1|4|16|64, 8|128, 1|4|16|64, 2|8|32|128, 2|32|128,
	    2|32, 2|8|32|128, 2|32|128, 1|2|4|8|16|32|64|128, 2|32|128, 128, 1|64|128,
	    4|8|16, 8, 2|8|32, 1|2|4|8|16|32|64|128, 2|8|32, 2|8|32|128, 2|32,
	    2|8|32, 2|8|32|128, 1|4|16|64, 8|128, 1|4|16|64, 2|8|128, 2|32|128,
	    2|32, 1|8|32, 2|8|32|128, 8|32|128, 2|8|32|128, 32|128, 2|32,
	    8|32, 8|32|128, 8|32|128, 8|32|128, 8|32|128, 8|32|128, 32,
	];
	
	Model.Game.cbSmessPromoPoss={
		"1": { 50:1,51:1,53:1,54:1 },
		"-1": { 1:1,2:1,4:1,5:1 },
	}
	
	Model.Game.cbSmessPieceGraph = function(geometry,longRange) {
		var $this=this;
		var flags = this.cbConstants.FLAG_MOVE | this.cbConstants.FLAG_CAPTURE;
		var graphDeltas={
			0:[-1,1],1:[0,1],2:[1,1],3:[1,0],4:[1,-1],5:[0,-1],6:[-1,-1],7:[-1,0],
		}
		var graph={};
		for(var pos=0;pos<geometry.boardSize;pos++) {
			graph[pos]=[];
			var deltas=[];
			for(var i=0;i<8;i++) {
				if(this.cbSmessGraph[pos] & (1<<i))
					deltas.push(graphDeltas[i]);
			}
			deltas.forEach(function(delta) {
				var line=[];
				var pos1=geometry.Graph(pos,delta);
				while(pos1!=null) {
					line.push(pos1 | flags);
					if(!longRange)
						break;
					else
						pos1=geometry.Graph(pos1,delta);
				} 
				if(line.length>0)
					graph[pos].push($this.cbTypedArray(line));
			});
		}
		return graph;
	}

})();


(function() {
	
	var geometry = Model.Game.cbBoardGeometrySmess(7,8);
	
	Model.Game.cbDefine = function() {
		
		return {
			
			geometry: geometry,
			
			pieceTypes: {

				0: {
					name: 'ninny',
					aspect: 'sm-pawn',
					graph: this.cbSmessPieceGraph(geometry,false),
					value: 1,
					abbrev: '',
					fenAbbrev: 'P',
					initial: [{s:1,p:7},{s:1,p:8},{s:1,p:9},{s:1,p:10},{s:1,p:11},{s:1,p:12},{s:1,p:13},
					          {s:-1,p:42},{s:-1,p:43},{s:-1,p:44},{s:-1,p:45},{s:-1,p:46},{s:-1,p:47},{s:-1,p:48},
					          ],
				},
				
				1: {
					name: 'numskull',
					aspect: 'sm-skull',
					graph: this.cbSmessPieceGraph(geometry,true),
					value: 4,
					abbrev: 'R',
					initial: [{s:1,p:1},{s:1,p:2},{s:1,p:4},{s:1,p:5},{s:-1,p:50},{s:-1,p:51},{s:-1,p:53},{s:-1,p:54}],
				},

				2: {
					name: 'brain',
					aspect: 'sm-brain',
					isKing: true,
					graph: this.cbSmessPieceGraph(geometry,false),
					abbrev: 'K',
					initial: [{s:1,p:3},{s:-1,p:52}],
				},
				
			},
			
			promote: function(aGame,piece,move) {
				if(piece.t==0 && (move.t in aGame.cbSmessPromoPoss[piece.s]))
					return [1];
				return [];
			},

			evaluate: function(aGame,evalValues,material) {
				// check lack of material to checkmate
				var white=material[1].count;
				var black=material[-1].count;
				
				if(white[0]==0 && white[1]==0 && black[0]==0 && black[1]==0) {
					this.mFinished=true;
					this.mWinner=JocGame.DRAW;					
				}
				
				// check 50 moves without capture
				if(this.noCaptCount>=100) {
					this.mFinished=true;
					this.mWinner=JocGame.DRAW;					
				}
				
				// motivate pawns to reach promotion
				var distPromo=aGame.cbUseTypedArrays?new Int8Array(5):[0,0,0,0,0];
				var distPromo0=aGame.cbVar.geometry.distPromo;
				
				var pawns=material[1].byType[0],pawnsLength;
				if(pawns) {
					pawnsLength=pawns.length;
					for(var i=0;i<pawnsLength;i++)
						switch(distPromo0[1][pawns[i].p]) {
						case 2: distPromo[0]++; break;
						case 3: distPromo[1]++; break;
						case 4: distPromo[2]++; break;
						case 5: distPromo[3]++; break;
						case 6: distPromo[4]++; break;
						}
				}
				pawns=material[-1].byType[2],pawnsLength;
				if(pawns) {
					pawnsLength=pawns.length;
					for(var i=0;i<pawnsLength;i++)
						switch(distPromo0[-1][pawns[i].p]) {
						case 1: distPromo[0]--; break;
						case 2: distPromo[1]--; break;
						case 3: distPromo[2]--; break;
						case 4: distPromo[3]--; break;
						case 5: distPromo[4]--; break;
						}
				}
				if(distPromo[0]!=0)
					evalValues['distPawnPromo1']=distPromo[0];
				if(distPromo[1]!=0)
					evalValues['distPawnPromo2']=distPromo[1];
				if(distPromo[2]!=0)
					evalValues['distPawnPromo3']=distPromo[2];
				if(distPromo[3]!=0)
					evalValues['distPawnPromo4']=distPromo[3];
				if(distPromo[4]!=0)
					evalValues['distPawnPromo5']=distPromo[4];
				
			},
		};
	}
	
})();
//# sourceMappingURL=smess-model.js.map
