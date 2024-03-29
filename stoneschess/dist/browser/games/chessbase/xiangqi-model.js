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
	
	Model.Game.cbBoardGeometryGrid = function(width,height) {
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
			var dist=[];
			for(var pos1=0;pos1<width*height;pos1++) {
				var dist1=[];
				dist.push(dist1);
				for(var pos2=0;pos2<width*height;pos2++) {
					var r1=R(pos1), c1=C(pos1), r2=R(pos2), c2=C(pos2);
					dist1.push(Math.max(Math.abs(r1-r2),Math.abs(c1-c2)));
				}
			}
			return dist;
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

		function ExportBoardState(board,cbVar,moveCount) {
			var fenRows = [];
			for(var r=height-1;r>=0;r--) {
				var fenRow = "";
				var emptyCount = 0;
				for(var c=0;c<width;c++) {
					var pieceIndex = board.board[POS(c,r)];
					if(pieceIndex<0)
						emptyCount++;
					else {
						if(emptyCount>0) {
							fenRow += emptyCount;
							emptyCount = 0;
						}
						var piece = board.pieces[pieceIndex];
						var abbrev = cbVar.pieceTypes[piece.t].fenAbbrev || cbVar.pieceTypes[piece.t].abbrev || "?";
						if(piece.s==-1)
							fenRow += abbrev.toLowerCase();
						else
							fenRow += abbrev.toUpperCase();
					}
				}
				if(emptyCount)
					fenRow += emptyCount;
				fenRows.push(fenRow);
			}
			var fen = fenRows.join("/");
			fen += " ";
			if(board.mWho==1)
				fen += "w";
			else
				fen += "b";
			fen += " ";
			var castle = "";
			if(board.castled) {
				if(board.castled[1]===false)
					castle += "KQ";
				else {
					if(board.castled[1].k)
						castle+= "K";
					if(board.castled[1].q)
						castle+= "Q";
				}
				if(board.castled[-1]===false)
					castle += "kq";
				else {
					if(board.castled[-1].k)
						castle+= "k";
					if(board.castled[-1].q)
						castle+= "q";
				}
			}
			if(castle.length==0)
				castle = "-";
			fen += castle;
			fen += " ";
			if(!board.epTarget)
				fen += "-";
			else
				fen += PosName(board.epTarget.p);
			fen += " ";
			fen += board.noCaptCount;
			fen += " ";
			fen += Math.floor(moveCount/2)+1;
			return fen;
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
			ExportBoardState: ExportBoardState
		};
	}

	/*
 	Piece graph: [ directions ]
 	Direction: [ Targets ]
 	Target: <position> | <flags bitmask>
 	<position>: 0xffff (invalid) or next position
	*/
	
	Model.Game.cbPawnGraph = function(geometry,side,confine) {
		var $this=this;
		var graph={};
		for(var pos=0;pos<geometry.boardSize;pos++) {
			if(confine && !(pos in confine)){
				graph[pos]=[];
				continue;
			}
			var directions=[];
			var pos1=geometry.Graph(pos,[0,side]);
			if(pos1!=null && (!confine || (pos1 in confine)))
				directions.push($this.cbTypedArray([pos1 | $this.cbConstants.FLAG_MOVE]));
			[-1,1].forEach(function(dc) {
				var pos2=geometry.Graph(pos,[dc,side]);
				if(pos2!=null && (!confine || (pos2 in confine)))
					directions.push($this.cbTypedArray([pos2 | $this.cbConstants.FLAG_CAPTURE]));				
			});
			graph[pos]=directions;
		}
		return graph;
	}
		
	Model.Game.cbInitialPawnGraph = function(geometry,side,confine) {
		var $this=this;
		var graph={};
		for(var pos=0;pos<geometry.boardSize;pos++) {
			if(confine && !(pos in confine)){
				graph[pos]=[];
				continue;
			}
			var directions=[];
			var pos1=geometry.Graph(pos,[0,side]);
			if(pos1!=null && (!confine || (pos1 in confine))) {
				var direction=[pos1 | $this.cbConstants.FLAG_MOVE];
				var pos2=geometry.Graph(pos1,[0,side]);
				if(pos2!=null && (!confine || (pos2 in confine)))
					direction.push(pos2 | $this.cbConstants.FLAG_MOVE);
				directions.push($this.cbTypedArray(direction));
			}
			[-1,1].forEach(function(dc) {
				var pos2=geometry.Graph(pos,[dc,side]);
				if(pos2!=null && (!confine || (pos2 in confine)))
					directions.push($this.cbTypedArray([pos2 | $this.cbConstants.FLAG_CAPTURE]));				
			});
			graph[pos]=directions;
		}
		return graph;
	}

	Model.Game.cbKingGraph = function(geometry,confine) {
		return this.cbShortRangeGraph(geometry,[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]],confine);
	}

	Model.Game.cbKnightGraph = function(geometry,confine) {
		return this.cbShortRangeGraph(geometry,[[2,-1],[2,1],[-2,-1],[-2,1],[-1,2],[-1,-2],[1,2],[1,-2]],confine);
	}

	Model.Game.cbHorseGraph = function(geometry) {
		var $this=this;
		var graph={};
		for(var pos=0;pos<geometry.boardSize;pos++) {
			graph[pos]=[];
			[[1,0,2,-1],[1,0,2,1],[-1,0,-2,-1],[-1,0,-2,1],[0,1,-1,2],[0,-1,-1,-2],[0,1,1,2],[0,-1,1,-2]].forEach(function(desc) {
				var pos1=geometry.Graph(pos,[desc[0],desc[1]]);
				if(pos1!=null) {
					var pos2=geometry.Graph(pos,[desc[2],desc[3]]);
					if(pos2!=null)
						graph[pos].push($this.cbTypedArray([pos1 | $this.cbConstants.FLAG_STOP, pos2 | $this.cbConstants.FLAG_MOVE | $this.cbConstants.FLAG_CAPTURE]));
				}
			});
		}
		return graph;
	}

	
	Model.Game.cbRookGraph = function(geometry,confine) {
		return this.cbLongRangeGraph(geometry,[[0,-1],[0,1],[-1,0],[1,0]],confine);
	}
	
	Model.Game.cbBishopGraph = function(geometry,confine) {
		return this.cbLongRangeGraph(geometry,[[1,-1],[1,1],[-1,1],[-1,-1]],confine);
	}
	
	Model.Game.cbQueenGraph = function(geometry,confine) {
		return this.cbLongRangeGraph(geometry,[[0,-1],[0,1],[-1,0],[1,0],[1,-1],[1,1],[-1,1],[-1,-1]],confine);
	}

	Model.Game.cbXQGeneralGraph = function(geometry,confine) {
		var $this=this;
		var graph={};
		for(var pos=0;pos<geometry.boardSize;pos++) {
			graph[pos]=[];
			[[-1,0,false],[0,-1,true],[0,1,true],[1,0,false]].forEach(function(delta) {
				var direction=[];
				var pos1=geometry.Graph(pos,delta);
				if(pos1!=null) {
					if(!confine || (pos1 in confine))
					direction.push(pos1 | $this.cbConstants.FLAG_MOVE | $this.cbConstants.FLAG_CAPTURE);
					if(delta[2]) {
						var pos2=geometry.Graph(pos1,delta);
						while(pos2!=null) {
							if(!confine || (pos2 in confine))
								direction.push(pos2 | $this.cbConstants.FLAG_CAPTURE | $this.cbConstants.FLAG_CAPTURE_KING);
							else
								direction.push(pos2 | $this.cbConstants.FLAG_STOP);
							pos2=geometry.Graph(pos2,delta);
						}
					}
				}
				if(direction.length>0)
					graph[pos].push($this.cbTypedArray(direction));
			});
		}
		return graph;
	}
	
	Model.Game.cbXQSoldierGraph = function(geometry,side) {
		return this.cbShortRangeGraph(geometry,[[0,side]]);
	}

	Model.Game.cbXQPromoSoldierGraph = function(geometry,side) {
		return this.cbShortRangeGraph(geometry,[[0,side],[-1,0],[1,0]]);
	}

	Model.Game.cbXQAdvisorGraph = function(geometry,confine) {
		return this.cbShortRangeGraph(geometry,[[1,1],[-1,1],[1,-1],[-1,-1]],confine);
	}

	Model.Game.cbXQCannonGraph = function(geometry) {
		return this.cbLongRangeGraph(geometry,[[0,-1],[0,1],[-1,0],[1,0]],null,this.cbConstants.FLAG_MOVE | this.cbConstants.FLAG_SCREEN_CAPTURE);
	}
	
	Model.Game.cbXQElephantGraph = function(geometry,confine) {
		var $this=this;
		var graph={};
		for(var pos=0;pos<geometry.boardSize;pos++) {
			graph[pos]=[];
			if(confine && !(pos in confine))
				continue;
			[[1,1,2,2],[1,-1,2,-2],[-1,1,-2,2],[-1,-1,-2,-2]].forEach(function(desc) {
				var pos1=geometry.Graph(pos,[desc[0],desc[1]]);
				if(pos1!=null) {
					var pos2=geometry.Graph(pos,[desc[2],desc[3]]);
					if(pos2!=null && (!confine || (pos2 in confine)))
						graph[pos].push($this.cbTypedArray([pos1 | $this.cbConstants.FLAG_STOP, pos2 | $this.cbConstants.FLAG_MOVE | $this.cbConstants.FLAG_CAPTURE]));
				}
			});
		}
		return graph;
	}
	
	Model.Game.cbSilverGraph = function(geometry,side) {
		return this.cbShortRangeGraph(geometry,[[0,side],[-1,-1],[-1,1],[1,-1],[1,1]]);
	}
	
	Model.Game.cbFersGraph = function(geometry,side) {
		return this.cbShortRangeGraph(geometry,[[-1,-1],[-1,1],[1,-1],[1,1]]);
	}	

	Model.Game.cbSchleichGraph = function(geometry,side) {
		return this.cbShortRangeGraph(geometry,[[-1,0],[1,0],[0,-1],[0,1]]);
	}	
	
	Model.Game.cbAlfilGraph = function(geometry,side) {
		return this.cbShortRangeGraph(geometry,[[-2,-2],[-2,2],[2,2],[2,-2]]);
	}	

})();


(function() {
	
	var geometry = Model.Game.cbBoardGeometryGrid(9,10);
	geometry.ADVISOR_AREA = {3:1,5:1,13:1,21:1,23:1,66:1,68:1,76:1,84:1,86:1};
	geometry.ELEPHANT_AREA = { 
		'1': {2:1,6:1,18:1,22:1,26:1,38:1,42:1}, 
		'-1': {83:1,87:1,63:1,67:1,71:1,47:1,51:1},
	};
	geometry.GENERAL_AREA = { 
		3:1, 4:1, 5:1,12:1,13:1,14:1,21:1,22:1,23:1,
		84:1,85:1,86:1,75:1,76:1,77:1,66:1,67:1,68:1
	};
	// TODO move params below into variant definition
	Model.Game.cbOnPerpetual = 1; // 3 times state repeat = repeater loses
	Model.Game.cbOnStaleMate = 1; // stalemate = last player loses

	
	Model.Game.cbDefine = function() {
		
		return {
			
			geometry: geometry,
			
			pieceTypes: {

				0: {
					name: 'pawn-w',
					aspect: 'xq-pawn',
					graph: this.cbXQPromoSoldierGraph(geometry,1),
					abbrev: '',
					value: 2,
					fenAbbrev: 'P',
				},
				
				1: {
					name: 'pawn-b',
					aspect: 'xq-pawn',
					graph: this.cbXQPromoSoldierGraph(geometry,-1),
					abbrev: '',
					value: 2,
					fenAbbrev: 'P',
				},

				2: {
					name: 'ipawn-w',
					aspect: 'xq-pawn',
					graph: this.cbXQSoldierGraph(geometry,1),
					abbrev: '',
					value: 1,
					fenAbbrev: 'P',
					initial: [{s:1,p:27},{s:1,p:29},{s:1,p:31},{s:1,p:33},{s:1,p:35}],
				},

				3: {
					name: 'ipawn-b',
					aspect: 'xq-pawn',
					graph: this.cbXQSoldierGraph(geometry,-1),
					abbrev: '',
					value: 1,
					fenAbbrev: 'P',
					initial: [{s:-1,p:54},{s:-1,p:56},{s:-1,p:58},{s:-1,p:60},{s:-1,p:62}],
				},
				
				4: {
					name: 'cannon',
					aspect: 'xq-cannon',
					graph: this.cbXQCannonGraph(geometry),
					abbrev: 'C',
					value: 4.5,
					initial: [{s:1,p:19},{s:1,p:25},{s:-1,p:64},{s:-1,p:70}],
				},
				
				5: {
					name: 'chariot',
					aspect: 'xq-chariot',
					graph: this.cbRookGraph(geometry),
					abbrev: 'R',
					value: 9,
					initial: [{s:1,p:0},{s:1,p:8},{s:-1,p:81},{s:-1,p:89}],
				},

				6: {
					name: 'horse',
					aspect: 'xq-horse',
					graph: this.cbHorseGraph(geometry),
					abbrev: 'H',
					value: 4,
					initial: [{s:1,p:1},{s:1,p:7},{s:-1,p:82},{s:-1,p:88}],
				},

				7: {
					name: 'elephant-w',
					aspect: 'xq-elephant',
					graph: this.cbXQElephantGraph(geometry,geometry.ELEPHANT_AREA[1]),
					abbrev: 'E',
					value: 2,
					initial: [{s:1,p:2},{s:1,p:6}],
				},
				
				8: {
					name: 'elephant-b',
					aspect: 'xq-elephant',
					graph: this.cbXQElephantGraph(geometry,geometry.ELEPHANT_AREA[-1]),
					abbrev: 'E',
					value: 2,
					initial: [{s:-1,p:83},{s:-1,p:87}],
				},
				
				9: {
					name: 'advisor',
					aspect: 'xq-advisor',
					graph: this.cbXQAdvisorGraph(geometry,geometry.ADVISOR_AREA),
					abbrev: 'A',
					value: 2,
					initial: [{s:1,p:3},{s:1,p:5},{s:-1,p:84},{s:-1,p:86}],
				},
				
				10: {
					name: 'general',
					aspect: 'xq-general',
					isKing: true,
					graph: this.cbXQGeneralGraph(geometry,geometry.GENERAL_AREA),
					abbrev: 'K',
					initial: [{s:1,p:4},{s:-1,p:85}],
				},
				
			},
			
			promote: function(aGame,piece,move) {
				if(piece.t==2 && move.t>=45)
					return [0];
				else if(piece.t==3 && move.t<45)
					return [1];
				return [];
				return [];
			},

			/*
			importGame: function(initial,format,data) {
				initial.pieces.forEach(function(piece) {
					if(piece.s==1 && geometry.R(piece.p)==1 && piece.t==0) {
						piece.t=1;
						piece.m=false;
					}
					if(piece.s==1 && geometry.R(piece.p)!=1 && piece.t==1) {
						piece.t=0;
						piece.m=true;
					}
					if(piece.s==-1 && geometry.R(piece.p)==geometry.height-2 && piece.t==2) {
						piece.t=3;
						piece.m=false;
					}
					if(piece.s==-1 && geometry.R(piece.p)!=geometry.height-2 && piece.t==3) {
						piece.t=2;
						piece.m=true;
					}
				});
				return true;
			},
			*/
		};
	}

	Model.Board.CompactMoveString = function(aGame,aMove) {
		var $this=this;
		function ColName(col) {
			if($this.mWho>0)
				return 9-col;
			else
				return col+1;
		}
		var letters={0:'P',1:'P',2:'P',3:'P',4:'C',5:'R',6:'H',7:'E',8:'E',9:'A',10:'K'};
		function GetNotation(aMove) {
			var piece=$this.pieces[$this.board[aMove.f]];
			var letter=letters[piece.t];
			var str=letter;
			var startCol=geometry.C(aMove.f);
			var endCol=geometry.C(aMove.t);
			var startRow=geometry.R(aMove.f);
			var endRow=geometry.R(aMove.t);
			var matching=[];
			$this.pieces.forEach(function(piece) {
				if(piece.p>=0 && piece.s==$this.mWho && letters[piece.t]==letter && geometry.C(piece.p)==startCol)
					matching.push(piece);
			});
			matching.sort(function(a,b) {
				return (geometry.R(a.p)-geometry.R(b.p))*$this.mWho;
			});
			if(matching.length==1)
				str+=ColName(startCol);
			else if(matching.length==2) {
				if(matching[0]==piece)
					str+='+';
				else
					str+='-';
			} else if(matching.length==3) {
				if(matching[0]==piece)
					str+='+';
				else if(matching[1]==piece)
					str+=ColName(startCol);
				else
					str+='-';
			} else if(matching.length==4) {
				if(matching[0]==piece)
					str='++';
				else if(matching[1]==piece)
					str+='+';
				else if(matching[2]==piece)
					str+='-';
				else
					str='--';
			} else if(matching.length==5) {
				if(matching[0]==piece)
					str='++';
				else if(matching[1]==piece)
					str+='+';
				else if(matching[2]==piece)
					str+=ColName(startCol);
				else if(matching[3]==piece)
					str+='-';
				else
					str='--';
			}
			
			if(startRow==endRow)
				str+='.'+ColName(endCol);
			else {
				if((endRow-startRow)*$this.mWho>0)
					str+='+';
				else
					str+='-';
				if(startCol!=endCol)
					str+=ColName(endCol);
				else if((endRow-startRow)*$this.mWho>0)
					str+=Math.abs(endRow-startRow);
				else 
					str+=Math.abs(endRow-startRow);
			}
			
			return str;
		}

		var moveStr0=GetNotation(aMove);
		
		var piece=this.pieces[this.board[aMove.f]];
		if(letters[piece.t]=='P' && geometry.R(aMove.f)==geometry.R(aMove.t)) {
			var tandemCols={};
			this.pieces.forEach(function(piece) {
				if(piece.p>=0 && piece.s==$this.mWho && letters[piece.t]=='P') {
					var startCol=geometry.C(piece.p);
					if(tandemCols[startCol]===undefined)
						tandemCols[startCol]=1;
					else
						tandemCols[startCol]++;
				}
			});
			var tandemCount=0;
			for(var col in tandemCols)
				if(tandemCols[col]>1)
					tandemCount++;
			if(tandemCount>1) {
				moveStr0=ColName(geometry.C(aMove.f))+moveStr0.substr(1);
			}
		}

		return moveStr0;
	}

	Model.Move.ToString = function(format) {
		var self = this;
		function PosName(pos) {
			var col = pos % 9;
			var row = (pos-col)/9;
			return String.fromCharCode(("a".charCodeAt(0))+col) + row;
		}
		return PosName(self.f) + PosName(self.t);
	}
	
})();
Model.Board.StaticGenerateMoves=function(a){return this.PickMoveFromDatabase(a,this.MoveDatabase)},Model.Board.MoveDatabase={"1#262583924":[{m:"Ch3-h7",e:10},{m:"Ch3-g3",e:10},{m:"Hb1-a3",e:10},{m:"Cb3-f3",e:10},{m:"c4-c5",e:10},{m:"Cb3-e3",e:10},{m:"Cb3-a3",e:10},{m:"Cb3-c3",e:10},{m:"Hb1-c3",e:10},{m:"Eg1-e3",e:10},{m:"i4-i5",e:10},{m:"Cb3-g3",e:10},{m:"g4-g5",e:10},{m:"Hh1-g3",e:10},{m:"Hh1-i3",e:10},{m:"Af1-e2",e:10},{m:"Ch3-d3",e:10},{m:"Ch3-e3",e:10},{m:"Ch3-i3",e:10},{m:"Ec1-e3",e:10},{m:"Ch3-h5",e:10},{m:"Ch3-f3",e:10},{m:"Cb3-d3",e:10},{m:"a4-a5",e:10},{m:"Ad1-e2",e:10},{m:"Ch3-c3",e:10}],"-1#2073307342":[{m:"Hh10-g8",e:6.667},{m:"g7-g6",e:6.667}],"1#-1186147453":[{m:"Hh1-g3",e:5}],"-1#-151945653":[{m:"g7-g6",e:5}],"1#-2085910218":[{m:"Ch7-g7",e:5}],"-1#-1937696873":[{m:"Ri10-h10",e:5}],"1#-692032922":[{m:"Ri1-h1",e:5}],"-1#-597872298":[{m:"Ec10-e8",e:5}],"1#-254856779":[{m:"Rh1-h5",e:5}],"-1#1610923805":[{m:"Ch8-i8",e:5}],"1#1575345646":[{m:"Rh5xh10",e:5}],"-1#897675454":[{m:"Hg8xh10",e:5}],"1#1776569175":[{m:"Cb3-e3",e:5}],"-1#-1012605747":[{m:"Hb10-d9",e:5}],"1#-913923113":[{m:"Ra1-a2",e:5}],"-1#1086794620":[{m:"Ci8-g8",e:5}],"1#369119284":[{m:"Ra2-d2",e:5}],"-1#-1039887858":[{m:"Ra10-a9",e:5}],"1#-631436465":[{m:"e4-e5",e:5}],"-1#1574104579":[{m:"Hh10-i8",e:5}],"1#-710288897":[{m:"Cg7-f7",e:5}],"-1#377641432":[{m:"g6-g5",e:5}],"1#1863565167":[{m:"e5-e6",e:5}],"-1#-436320062":[{m:"g5xg4",e:5}],"1#-836065713":[{m:"Hg3-e4",e:5}],"-1#760681296":[{m:"e7xe6",e:5}],"1#-809462646":[{m:"Ce3xe6+",e:5}],"-1#827859334":[{m:"Hd9-e7",e:5}],"1#609052724":[{m:"Eg1-e3",e:5}],"-1#-1563136282":[{m:"g4-f4",e:5}],"1#1314254622":[{m:"Cf7xc7",e:5}],"-1#-2123546031":[{m:"Cg8-g7",e:5}],"1#-1014282927":[{m:"He4-c5",e:5}],"-1#1634180010":[{m:"Ra9-c9",e:5}],"1#1170758277":[{m:"Cc7xg7",e:5}],"-1#-684240150":[{m:"Hi8xg7",e:5}],"1#1417013285":[{m:"Rd2-d7",e:5}],"-1#-911585090":[{m:"Hg7-f5",e:5}],"1#-676303166":[{m:"Hc5-b7",e:5}],"-1#-1638137748":[{m:"Rc9xc4",e:5}],"1#65234845":[{m:"Hb1-a3",e:5}],"-1#473816005":[{m:"Rc4-d4",e:5}],"1#424381598":[{m:"Rd7-d8",e:5}],"-1#1329174947":[{m:"Rd4xd8",e:5}],"1#30739704":[{m:"Hb7xd8+",e:5}],"-1#-1072854546":[{m:"Ke10-e9",e:5}],"1#-511593909":[{m:"Hd8-c6",e:5}],"-1#262123663":[{m:"Cb8-a8",e:5}],"1#-962755761":[{m:"a4-a5",e:5}],"-1#-386718205":[{m:"Ke9-f9",e:5}],"1#-1888973421":[{m:"Hc6xa7",e:5}],"-1#-105894962":[{m:"Hf5-d4",e:5}],"1#1640378172":[{m:"Ce6xe8",e:5}],"-1#-1111051954":[{m:"Ca8xa5",e:5}],"1#-1509757421":[{m:"Ad1-e2",e:5}],"-1#-385089773":[{m:"Ca5-a4",e:5}],"1#144462631":[{m:"Ce8-h8",e:5}],"-1#-2070926388":[{m:"He7-g6",e:5}],"1#1134040221":[{m:"Ch8-h2",e:5}],"-1#-1178364511":[{m:"Af10-e9",e:5}],"1#-1251454669":[{m:"Ch2-f2+",e:5}],"-1#450775419":[{m:"Ae9-f8",e:5}],"1#1305978465":[{m:"Ha3-c4",e:5}],"-1#1760513955":[{m:"Ad10-e9",e:5}],"1#-2077329582":[{m:"Ha7-c8",e:5}],"-1#-288315301":[{m:"Kf9-f10",e:5}],"1#-712041316":[{m:"Hc8xe9",e:5}],"-1#-1757409066":[{m:"Ca4-a1+",e:5}],"1#-165831803":[{m:"Ec1-a3",e:5}],"-1#1496600442":[{m:"Hg6-e5",e:5}],"1#-1991270775":[{m:"Hc4-b2",e:5}],"-1#-1144881973":[{m:"Hd4-b3",e:5}],"1#1858708066":[{m:"He9xg10",e:5}],"-1#1820603850":[{m:"He5-c4",e:5}],"1#-2077957128":[{m:"Hg10xf8",e:5}],"-1#2038316223":[{m:"Hc4xa3",e:5}],"1#1280498126":[{m:"Hf8-e6+",e:5}],"-1#-1871679140":[{m:"f4-e4",e:5}],"1#1297562669":[{m:"He6-d8",e:5}],"-1#1742861911":[{m:"Hb3-d4",e:5}],"1#-1293276930":[],"1#248438707":[{m:"c4-c5",e:5}],"-1#-1042422981":[{m:"Ch8-e8",e:5}],"1#-1565224448":[{m:"Hh1-g3",e:5}],"-1#-318160952":[{m:"Cb8-c8",e:5}],"1#1643607466":[{m:"Ec1-e3",e:5}],"-1#-753820797":[{m:"Hb10-a8",e:5}],"1#-1719215231":[{m:"Hb1-d2",e:5}],"-1#1270991492":[{m:"Ri10-i9",e:5}],"1#174792416":[{m:"Ra1-b1",e:5}],"-1#1019735580":[{m:"Ra10-a9",e:5}],"1#614365021":[{m:"Ri1-h1",e:5}],"-1#771959917":[{m:"Ra9-d9",e:5}],"1#1100165582":[{m:"Hd2-f3",e:5}],"-1#1052324320":[{m:"Ce8xe4+",e:5}],"1#-25467127":[{m:"Af1-e2",e:5}],"-1#-1507684925":[{m:"Rd9-d5",e:5}],"1#1215810918":[{m:"Ch7-h5",e:5}],"-1#1372007086":[{m:"Ce4-f4",e:5}],"1#1997931650":[{m:"Cb3-b5",e:5}],"-1#1079989308":[{m:"Ri9-b9",e:5}],"1#20736499":[{m:"Cb5xd5",e:5}],"-1#1136235406":[{m:"Rb9xb1",e:5}],"1#-1817871678":[{m:"Ch5-e5+",e:5}],"-1#-733050407":[{m:"Eg10-e8",e:5}],"1#387167526":[{m:"Rh1xh10",e:5}],"-1#1407218187":[{m:"e7-e6",e:5}],"1#-248379524":[{m:"Ce5-h5",e:5}],"-1#-1227230105":[{m:"e6-e5",e:5}],"1#1511649491":[{m:"Cd5-d7",e:5}],"-1#1157670705":[{m:"Ad10-e9",e:5}],"1#-1446928448":[{m:"Cd7-e7",e:5}],"-1#-746133298":[{m:"Cf4-e4",e:5}],"1#-178796830":[{m:"Ce7xe4",e:5}],"-1#1892456024":[{m:"e5xe4",e:5}],"1#-1838986100":[{m:"Hf3-e5",e:5}],"-1#1994763325":[{m:"e4-f4",e:5}],"1#1087145488":[{m:"He5-f7",e:5}],"-1#210767394":[{m:"Cc8-c9",e:5}],"1#-651017971":[{m:"Ch5-e5",e:5}],"-1#-1629900266":[{m:"Rb1-b6",e:5}],"1#205583026":[{m:"c5-c6",e:5}],"-1#1671111694":[{m:"c7xc6",e:5}],"1#-235538270":[{m:"Hf7xe9",e:5}],"-1#-1244646448":[{m:"Ke10-d10",e:5}],"1#-869886295":[{m:"Rh10xf10+",e:5}],"-1#-799071231":[{m:"Kd10-d9",e:5}],"1#-160020958":[{m:"Rf10xf4",e:5}],"-1#-352258597":[{m:"Rb6-b8",e:5}],"1#131307030":[{m:"He9-g8",e:5}],"-1#-696389379":[{m:"Rb8-d8",e:5}],"1#1467627920":[{m:"Hg8-f10+",e:5}],"-1#-553730412":[{m:"Kd9-d10",e:5}],"1#-120070985":[{m:"Rf4-f9",e:5}],"-1#-1038648707":[{m:"Rd8-d5",e:5}],"1#2128600224":[{m:"Ce5-e4",e:5}],"-1#1477918374":[{m:"Rd5-d4",e:5}],"1#605585675":[{m:"Rf9-e9",e:5}],"-1#-1577696470":[{m:"Ee8-g10",e:5}],"1#1655406549":[{m:"g4-g5",e:5}],"-1#778078520":[{m:"g6xg5",e:5}],"1#-1264303857":[{m:"Ee3xg5",e:5}],"-1#-248457905":[{m:"Rd4-d5",e:5}],"1#-1925223710":[{m:"Ce4-e3",e:5}],"-1#-620131479":[{m:"c6-c5",e:5}],"1#1428398344":[{m:"Hg3-e4",e:5}],"-1#-1235348457":[{m:"Eg10-e8",e:5}],"1#1963141352":[{m:"He4-f6",e:5}],"-1#1020382087":[{m:"Rd5-e5",e:5}],"1#-1738161821":[{m:"Re9-d9+",e:5}],"-1#440557935":[{m:"Kd10-e10",e:5}],"1#1672791062":[{m:"Hf10xe8",e:5}],"-1#1679634090":[{m:"c5-d5",e:5}],"1#-1323044448":[{m:"He8-g9+",e:5}],"-1#-1040683934":[{m:"Ke10-f10",e:5}],"1#-1129297776":[{m:"Ce3-f3+",e:5}],"-1#-559505220":[{m:"Re5-f5",e:5}],"1#-2137782022":[{m:"Hf6-e8+",e:5}],"-1#2044181777":[],"-1#291023442":[{m:"c7-c6",e:8},{m:"Ch8-e8",e:8},{m:"Hh10-i8",e:8}],"1#-767602327":[{m:"Eg1-e3",e:5}],"-1#1420187579":[{m:"Hb10-c8",e:5}],"1#1169573127":[{m:"Hb1-a3",e:5}],"-1#1516829023":[{m:"Hh10-i8",e:5}],"1#-770453853":[{m:"Ra1-a2",e:5}],"-1#1532118536":[{m:"Ri10-h10",e:5}],"1#18037753":[{m:"Ra2-d2",e:5}],"-1#-719849021":[{m:"Ec10-e8",e:5}],"1#-108660448":[{m:"Hh1-f2",e:5}],"-1#-808436815":[{m:"Ad10-e9",e:5}],"1#588317504":[{m:"Ri1-h1",e:5}],"-1#697063536":[{m:"Ch8-h4",e:5}],"1#201679642":[{m:"g4-g5",e:5}],"-1#1087280631":[{m:"i7-i6",e:5}],"1#1327717160":[{m:"Rd2-d7",e:5}],"-1#-755178573":[{m:"Ra10-d10",e:5}],"1#349364953":[{m:"Rd7-c7",e:5}],"-1#623918355":[{m:"Ch4xc4",e:5}],"1#-599193701":[{m:"Rh1xh10",e:5}],"-1#960172818":[{m:"Cc4xc7",e:5}],"1#-250681971":[{m:"Rh10-h2",e:5}],"-1#331618033":[{m:"Rd10-d2",e:5}],"1#355047200":[{m:"Cb3-c3",e:5}],"-1#532788281":[{m:"Cc7xc3",e:5}],"1#-1053561277":[{m:"Cg3xc3",e:5}],"-1#-1413808287":[{m:"Hc8-d6",e:5}],"1#-2130160414":[{m:"a4-a5",e:5}],"-1#-1352207954":[{m:"Hd6xe4",e:5}],"1#-1377185405":[{m:"Cc3-d3",e:5}],"-1#243127500":[{m:"c6-c5",e:5}],"1#-2141716819":[{m:"Rh2-h4",e:5}],"-1#-533470568":[{m:"He4-f6",e:5}],"1#-1729268500":[{m:"Ad1-e2",e:5}],"-1#-672897556":[{m:"Cb8-b6",e:5}],"1#437245139":[{m:"Ee3xc5",e:5}],"-1#719970781":[{m:"Cb6-e6+",e:5}],"1#933917811":[{m:"Cd3-e3",e:5}],"-1#-207429826":[{m:"Ke10-d10",e:5}],"1#-1974175161":[{m:"Hf2-e4",e:5}],"-1#281124865":[{m:"Rd2-d4",e:5}],"1#243044099":[{m:"Rh4-f4",e:5}],"-1#-1251833565":[{m:"Rd4xe4",e:5}],"1#-646282225":[{m:"Rf4xf6",e:5}],"-1#-1077126180":[{m:"Re4-d4",e:5}],"1#-59428291":[{m:"Rf6xe6",e:5}],"-1#137424360":[{m:"e7xe6",e:5}],"1#1390047891":[{m:"Ha3-b5",e:5}],"-1#1451117546":[{m:"Hi8-h6",e:5}],"1#-2129367084":[{m:"Hb5xa7",e:5}],"-1#-1752206275":[{m:"Hh6xi4",e:5}],"1#-437740110":[{m:"Ce3-d3+",e:5}],"-1#568342271":[{m:"Kd10-e10",e:5}],"1#1477874566":[{m:"Ha7-c8",e:5}],"-1#-692468570":[{m:"e6-e5",e:5}],"1#981057554":[{m:"a5-a6",e:5}],"-1#-1693052658":[{m:"Hi4xg5",e:5}],"1#961642341":[{m:"a6-a7",e:5}],"-1#-286498789":[{m:"e5-e4",e:5}],"1#1440855194":[{m:"a7-b7",e:5}],"-1#658940586":[{m:"g7-g6",e:5}],"1#1377588695":[{m:"b7-b8",e:5}],"-1#787620143":[{m:"Rd4-b4",e:5}],"1#903436782":[{m:"b8-a8",e:5}],"-1#1784382153":[{m:"Rb4-b1",e:5}],"1#465321332":[{m:"Ec5-a3",e:5}],"-1#1382575551":[{m:"Hg5-e6",e:5}],"1#-1242501424":[{m:"Hc8-d6",e:5}],"-1#-1905576064":[{m:"e4-d4",e:5}],"1#265026150":[{m:"Cd3-f3",e:5}],"-1#-1274507658":[{m:"g6-g5",e:5}],"1#-845584191":[{m:"Cf3-f9",e:5}],"-1#-1541866526":[{m:"Ee8-c6",e:5}],"1#767601212":[{m:"a8-a9",e:5}],"-1#-2059591608":[{m:"Rb1-b8",e:5}],"1#8524293":[{m:"Cf9-f3",e:5}],"-1#1761837350":[{m:"Rb8-d8",e:5}],"1#904526971":[{m:"Cf3-g3",e:5}],"-1#328630677":[{m:"Eg10-e8",e:5}],"1#-791954070":[],"1#1915870057":[{m:"Hb1-c3",e:5}],"-1#543797284":[{m:"Hh10-g8",e:5}],"1#-491697303":[{m:"Eg1-e3",e:5}],"-1#1680362939":[{m:"Ri10-h10",e:5}],"1#1047081034":[{m:"Hh1-i3",e:5}],"-1#669462644":[{m:"g7-g6",e:5}],"1#1388168969":[{m:"Ri1-i2",e:5}],"-1#133794657":[{m:"Hb10-a8",e:5}],"1#1299106659":[{m:"c4-c5",e:5}],"-1#-2105673749":[{m:"Hg8-f6",e:5}],"1#537666392":[{m:"Af1-e2",e:5}],"-1#2018888082":[{m:"Hf6xe4",e:5}],"1#1963038521":[{m:"Hc3xe4",e:5}],"-1#2131778288":[{m:"Ce8xe4",e:5}],"1#-484495169":[{m:"Ri2-f2",e:5}],"-1#-271910203":[{m:"Cb8-e8",e:5}],"1#-631059091":[{m:"Ke1-f1",e:5}],"-1#1596572308":[{m:"Af10-e9",e:5}],"1#1401030150":[{m:"Ra1-b1",e:5}],"-1#1697576698":[{m:"Ra10-b10",e:5}],"1#1566365795":[{m:"Cb3-b8",e:5}],"-1#1437602962":[{m:"Rh10-h3",e:5}],"1#-43431698":[{m:"Rf2-i2",e:5}],"-1#-239304044":[{m:"Rh3xg3",e:5}],"1#1835738739":[{m:"Ri2-i1",e:5}],"-1#942631451":[{m:"Rg3-h3",e:5}],"1#690037715":[{m:"i4-i5",e:5}],"-1#-1757529165":[{m:"a7-a6",e:5}],"1#-1826871631":[{m:"Hi3-h1",e:5}],"-1#-1970133361":[{m:"Rh3-h7",e:5}],"1#394309997":[{m:"Hh1-f2",e:5}],"-1#567636988":[{m:"Rh7-f7",e:5}],"1#-1918736825":[{m:"Ri1-i2",e:5}],"-1#-656004561":[{m:"Ce8-f8",e:5}],"1#-1038242554":[{m:"Ae2-d3",e:5}],"-1#-788317812":[{m:"Ke10-f10",e:5}],"1#-1404363394":[{m:"Ad1-e2",e:5}],"-1#-482210690":[{m:"Rf7-f6",e:5}],"1#-1044166004":[{m:"Rb1-b4",e:5}],"-1#-1851442730":[{m:"Ce4-e5",e:5}],"1#-830226521":[{m:"Kf1-e1",e:5}],"-1#1271443550":[{m:"Ha8-b6",e:5}],"1#-837143151":[{m:"Ke1-d1",e:5}],"-1#-179722783":[{m:"Cf8-d8+",e:5}],"1#-1218477677":[{m:"Kd1-e1",e:5}],"-1#-1945366045":[{m:"Rb10xb8",e:5}],"1#-1063554899":[],"1#-1725719122":[{m:"Eg1-e3",e:6.667}],"-1#532323196":[{m:"Ri10-h10",e:6.667}],"1#1174136461":[{m:"Hb1-c3",e:6.667}],"-1#396594624":[{m:"c7-c6",e:6.667}],"1#-725321989":[{m:"Ra1-a2",e:6.667}],"-1#1569062480":[{m:"Hb10-c8",e:6.667}],"1#1284893932":[{m:"Ra2-f2",e:6.667}],"-1#-21535296":[{m:"Ec10-e8",e:6.667}],"1#-769301213":[{m:"Rf2-f5",e:6.667}],"-1#190819128":[{m:"Ad10-e9",e:6.667}],"1#-409037879":[{m:"Hh1-f2",e:6.667}],"-1#-775204520":[{m:"Ch8-f8",e:6.667}],"1#315755377":[{m:"Hf2-d3",e:6.667}],"-1#-516233854":[{m:"Ra10-d10",e:6.667}],"1#655680744":[{m:"c4-c5",e:6.667}],"-1#-402139040":[{m:"Rh10-h6",e:6.667}],"1#1305502010":[{m:"Af1-e2",e:6.667}],"-1#361335792":[{m:"i7-i6",e:6.667}],"1#442778927":[{m:"i4-i5",e:6.667}],"-1#-1535419057":[{m:"i6xi5",e:6.667}],"1#-2044632508":[{m:"Rf5xi5",e:6.667}],"-1#-1799102191":[{m:"c6xc5",e:6.667}],"1#-1346686843":[{m:"Hd3xc5",e:6.667}],"-1#-775691595":[{m:"Cb8-b10",e:6.667}],"1#-985325441":[{m:"Hc3-b5",e:6.667}],"-1#-1939354093":[{m:"Cb10-c10",e:8}],"1#569133783":[{m:"Hc5-d3",e:8},{m:"Ri1-f1",e:8}],"-1#-360865639":[{m:"Cc10-b10",e:6.667}],"1#1207313501":[{m:"Hc3-b5",e:6.667}],"-1#211866141":[{m:"Cc10xc5",e:6.667}],"1#-1869424051":[{m:"Ri5xc5",e:6.667}],"-1#1415719103":[{m:"Hc8-d6",e:6.667}],"1#2127594300":[{m:"e4-e5",e:6.667}],"-1#-111188368":[{m:"Hd6xb5",e:6.667}],"1#2145516176":[{m:"Rc5xb5",e:6.667}],"-1#-1822061345":[{m:"e7-e6",e:6.667}],"1#834140584":[{m:"g4-g5",e:6.667}],"-1#2105282373":[{m:"e6xe5",e:6.667}],"1#-157731442":[{m:"Rb5xe5",e:6.667}],"-1#1324314843":[{m:"Rd10-b10",e:6.667}],"1#-1385273255":[{m:"Re5-e7",e:6.667}],"-1#-944510520":[{m:"a7-a6",e:6.667}],"1#-1013844790":[{m:"Re7-a7",e:6.667}],"-1#724337783":[{m:"Rh6-c6",e:6.667}],"1#-579644314":[{m:"Cb3-d3",e:6.667}],"-1#-408740963":[{m:"g7-g6",e:6.667}],"1#-1829114656":[{m:"Cd3-d7",e:6.667}],"-1#965539115":[{m:"Rb10-c10",e:6.667}],"1#1238432814":[{m:"Cd7-e7",e:6.667}],"-1#865569568":[{m:"Rc6-c7",e:6.667}],"1#1472749023":[{m:"g5xg6",e:6.667}],"-1#1021658569":[{m:"Cf8-g8",e:6.667}],"1#-1797650853":[{m:"g6-f6",e:6.667}],"-1#-1885229937":[{m:"Hi8-g7",e:6.667}],"1#-117321693":[{m:"Ra7xc7",e:6.667}],"-1#-2070857479":[{m:"Rc10xc7",e:6.667}],"1#-708397444":[{m:"Cg3xg8",e:6.667}],"-1#218729972":[{m:"Rc7xe7",e:6.667}],"1#-791150460":[{m:"f6-f7",e:6.667}],"-1#-318904607":[{m:"Re7-c7",e:6.667}],"1#-1748331775":[{m:"f7xg7",e:6.667}],"-1#-1460496656":[{m:"Rc7xg7",e:6.667}],"1#48107281":[{m:"Rf1-g1",e:6.667}],"-1#1402128631":[{m:"Rg7-a7",e:6.667}],"1#2137964444":[{m:"Rg1-g5",e:6.667}],"-1#-312120676":[{m:"Ra7-b7",e:8}],"1#1233496236":[{m:"Rg5-g4",e:8},{m:"Cg8-g7",e:8}],"-1#-1828059819":[{m:"Rb7-a7",e:6.667}],"1#938133349":[{m:"Rg1-g5",e:6.667}],"-1#-1148585139":[{m:"Rb7-e7",e:6.667}],"1#-2134723021":[{m:"Ec1-a3",e:6.667}],"-1#803955404":[{m:"Re7-d7",e:8},{m:"Re7-f7",e:8}],"1#897146786":[{m:"Ee3-c5",e:6.667}],"-1#-1334422830":[{m:"Rd7-a7",e:6.667}],"1#894427378":[{m:"Ec5-e3",e:6.667}],"-1#-1337922174":[{m:"Ra7-e7",e:6.667}],"1#842421693":[{m:"Ea3-c1",e:6.667}],"-1#-1658879678":[{m:"Re7-d7",e:6.667}],"1#-2020754388":[{m:"Ee3-g1",e:6.667}],"-1#18135806":[{m:"Rd7-e7",e:8}],"1#461801360":[{m:"Ec1-e3",e:8},{m:"Eg1-i3",e:8}],"-1#-1453299271":[{m:"Re7-d7",e:6.667}],"1#-1275964201":[{m:"Eg1-i3",e:6.667}],"-1#1167168868":[{m:"Rd7-e7",e:6.667}],"1#1594075146":[{m:"Ee3-g1",e:6.667}],"-1#-70754738":[{m:"Re7-d7",e:6.667}],"1#-514170080":[{m:"Rg5-g3",e:6.667}],"-1#-240519282":[{m:"Rd7-a7",e:6.667}],"1#1955612078":[{m:"Rg3-g5",e:6.667}],"-1#1684263168":[{m:"Ra7-e7",e:6.667}],"1#-434804417":[{m:"Eg1-e3",e:6.667}],"-1#1121886075":[{m:"Re7-d7",e:6.667}],"1#1481417237":[{m:"Ee3-c5",e:6.667}],"-1#2116486980":[{m:"Rd7-a7",e:6.667}],"1#-81873564":[{m:"Ec5-a3",e:6.667}],"-1#-1061541149":[{m:"Ra7-e7",e:6.667}],"1#1120703196":[{m:"Ei3-g1",e:6.667}],"-1#-1263578257":[{m:"Re7-d7",e:6.667}],"1#-1371705855":[{m:"Ee3-g1",e:6.667}],"-1#-303741405":[{m:"Re7-d7",e:6.667}],"1#-143164595":[{m:"Rg5-g1",e:6.667}],"-1#1702669901":[{m:"Eg10-i8",e:6.667}],"1#994616615":[{m:"Cg7-g3",e:6.667}],"-1#1588508954":[{m:"Rd7-d4",e:6.667}],"1#1659445492":[{m:"Cg3-e3",e:6.667}],"-1#995983943":[{m:"Ke10-d10",e:6.667}],"1#1118512958":[{m:"Rg1-g7",e:6.667}],"-1#-1623275337":[{m:"Rd4xa4",e:6.667}],"1#-1427281346":[{m:"Rg7-a7",e:6.667}],"-1#707454869":[{m:"Ra4-c4",e:6.667}],"1#-1373105048":[{m:"Ra7-a10+",e:6.667}],"-1#-1478313248":[{m:"Rc4-c10",e:6.667}],"1#689525487":[{m:"Ra10xa6",e:6.667}],"-1#-1733436806":[{m:"Ei8-g10",e:6.667}],"1#-962998000":[{m:"Ei3-g5",e:6.667}],"-1#-101408108":[{m:"Rc10xc1",e:6.667}],"1#-662940864":[{m:"Ce3-g3",e:6.667}],"-1#-2117537293":[{m:"Rc1-c10",e:6.667}],"1#1958173303":[{m:"Ae2-d3",e:6.667}],"-1#1739181821":[{m:"Kd10-e10",e:6.667}],"1#509569924":[{m:"Ra6-a7",e:6.667}],"-1#-1915790309":[{m:"Eg10-i8",e:6.667}],"1#-738502799":[{m:"Cg3-e3",e:6.667}],"-1#-1974471230":[{m:"Ke10-d10",e:6.667}],"1#-205958981":[{m:"Ce3-h3",e:6.667}],"-1#-1456547489":[{m:"Ei8-g10",e:6.667}],"1#-149237195":[{m:"Ch3-g3",e:6.667}],"-1#-370881005":[{m:"Eg10-i8",e:6.667}],"1#-1211054727":[{m:"Ra7-d7+",e:6.667}],"-1#-279614863":[{m:"Kd10-e10",e:6.667}],"1#-1767649528":[{m:"Rd7-i7",e:6.667}],"-1#-899254887":[{m:"Ei8-g10",e:6.667}],"1#-1806532877":[{m:"Ri7-i10",e:6.667}],"-1#-177197998":[{m:"Rc10-d10",e:6.667}],"1#2070940324":[{m:"Ad3-e2",e:6.667}],"-1#1752079918":[],"1#1531245448":[{m:"Ae2-d3",e:6.667}],"-1#1213884162":[{m:"Rf7-e7",e:6.667}],"1#1022752326":[{m:"Ec1-a3",e:6.667},{m:"Ad1-e2",e:8}],"-1#1945954118":[{m:"Re7-b7",e:6.667}],"1#1219996216":[{m:"Ae2-d1",e:6.667}],"-1#129940280":[{m:"Rf7-e7",e:6.667}],"-1#276302380":[{m:"Hb10-c8",e:9.953},{m:"g7-g6",e:9.953},{m:"a7-a6",e:9.953},{m:"Cb8-e8",e:9.953},{m:"Hh10-g8",e:9.953},{m:"Ch8-d8",e:9.953},{m:"Ec10-e8",e:9.953},{m:"Ch8-e8",e:9.953},{m:"Eg10-e8",e:9.953}],"1#23599248":[{m:"c4-c5",e:9.688},{m:"Eg1-e3",e:9.688},{m:"Hh1-g3",e:9.688},{m:"Cb3-c3",e:9.688},{m:"Hb1-a3",e:9.998},{m:"Ra1-a2",e:9.688},{m:"Ch3-c3",e:9.688},{m:"g4-g5",e:9.688}],"-1#-830790632":[{m:"g7-g6",e:7.5}],"1#-1155411099":[{m:"Ch3-e3",e:7.5},{m:"Cb3-c3",e:7.5}],"-1#-508142975":[{m:"Hh10-g8",e:6.667}],"1#594452940":[{m:"Hh1-g3",e:6.667}],"-1#-1312165764":[{m:"Hh10-g8",e:6.667}],"-1#-2014241214":[{m:"Eg10-e8",e:9.524},{m:"Ch8-e8",e:9.524},{m:"c7-c6",e:9.524},{m:"Ec10-e8",e:9.524},{m:"Hh10-i8",e:9.524}],"-1#1322628440":[{m:"c7-c6",e:8.333},{m:"g7-g6",e:8.333},{m:"a7-a6",e:8.333}],"1#-1917694365":[{m:"Ri1-i2",e:5}],"1#999244325":[{m:"Hh1-g3",e:5},{m:"c4-c5",e:8.571},{m:"Ra1-a2",e:8.571}],"-1#367126377":[{m:"Ch8-f8",e:8},{m:"c7-c6",e:8},{m:"Hh10-g8",e:8},{m:"a7-a6",e:8}],"1#-688341696":[{m:"Ri1-h1",e:5}],"-1#-597301648":[{m:"Hh10-g8",e:5}],"1#515710269":[{m:"Ha3-b5",e:5}],"-1#437855300":[{m:"Cb8xb3",e:5}],"1#1679485523":[{m:"Ch3xb3",e:5}],"-1#823228195":[{m:"c7-c6",e:5}],"1#-227111912":[{m:"Rh1-h5",e:5}],"-1#1656554160":[{m:"Ri10-h10",e:5}],"1#956071745":[{m:"Rh5xh10",e:5}],"-1#1352192529":[{m:"Hg8xh10",e:5}],"1#-695853998":[{m:"Ri1-i2",e:5}],"-1#-2084417478":[{m:"Ch8-e8",e:5}],"1#-525655807":[{m:"Ha3-b5",e:5}],"-1#-468772744":[{m:"Hh10-g8",e:5}],"1#651682613":[{m:"Cb3xb8",e:5}],"-1#-2132094577":[{m:"Ce8xb8",e:5}],"1#851722063":[{m:"Ri2-d2",e:5}],"-1#-1662413908":[{m:"Ri10-h10",e:5}],"1#-962007459":[{m:"Ch3-i3",e:5}],"1#-684123100":[{m:"Ha3-b5",e:8.333}],"-1#-744676003":[{m:"Cb8xb3",e:8.333},{m:"Cb8-b6",e:8.333},{m:"Hg8-f6",e:8.333},{m:"Cb8-a8",e:8.333}],"1#-1382094006":[{m:"Ch3xb3",e:5}],"1#511087714":[{m:"Cb3xb6",e:5}],"1#1911353838":[{m:"Cb3xb8",e:6.667}],"1#446633629":[{m:"Hb5-d6",e:5}],"1#298056299":[{m:"Ha3-b5",e:5}],"-1#359121682":[{m:"Cb8-a8",e:5}],"1#-597298990":[{m:"Hb5-d6",e:5}],"-1#1342597579":[{m:"Hh10-g8",e:5}],"1#-1830907258":[{m:"Hd6-f7",e:5}],"-1#7403286":[{m:"Ch8-h9",e:5}],"1#1476629781":[{m:"Hf7-g9+",e:5}],"-1#1628751023":[{m:"Ke10-e9",e:5}],"1#1083768586":[{m:"Ra1-b1",e:5}],"-1#1983123446":[{m:"Ca8-b8",e:5}],"1#1257744474":[{m:"Cb3-d3",e:5}],"-1#192953225":[{m:"Ra10-b10",e:8.333}],"1#871503120":[{m:"Ra1-b1",e:8.333}],"-1#90105324":[{m:"Ch8-e8",e:8.333},{m:"Cb8-b4",e:8.333},{m:"g7-g6",e:8.333}],"1#-1198281496":[{m:"c4-c5",e:7.5}],"-1#1543475572":[{m:"Hh10-g8",e:8.75},{m:"Cb8-a8",e:8.75},{m:"Ec10-e8",e:8.75},{m:"Hb10-c8",e:9},{m:"Ch8-f8",e:8.75}],"1#782591497":[{m:"Hh1-g3",e:7.5},{m:"Cb3-c3",e:7.5}],"-1#-2010542021":[{m:"Hh10-g8",e:7.5},{m:"Cb8-a8",e:7.5},{m:"g7-g6",e:7.5}],"1#1257335670":[{m:"g4-g5",e:5}],"-1#104504731":[{m:"Cb8-a8",e:5}],"1#1093379067":[{m:"Eg1-e3",e:5}],"-1#1013137270":[{m:"Ch8-e8",e:5}],"1#1594510925":[{m:"Hh1-g3",e:5}],"-1#280486789":[{m:"Hh10-g8",e:5}],"1#-764471096":[{m:"Cc3xc7",e:5}],"-1#-1737551267":[{m:"Ri10-h10",e:5}],"1#-1037144148":[{m:"Cb3-c3",e:5}],"-1#1302589053":[{m:"Ra10-a9",e:9.091},{m:"c7-c6",e:9.091}],"1#1442477884":[{m:"Eg1-e3",e:6.667}],"-1#-748457490":[{m:"c7-c6",e:7.5},{m:"Ch8-e8",e:7.5}],"1#-1899752122":[{m:"Ra1-a2",e:9.091},{m:"Cb3-c3",e:9.091},{m:"Hh1-g3",e:9.091}],"1#1696791889":[{m:"Eg1-e3",e:9.89},{m:"Ch3-e3",e:9.89},{m:"Cb3-c3",e:9.89},{m:"Hb1-a3",e:8.333},{m:"Ra1-a2",e:9.89},{m:"Hb1-a3",e:9.982},{m:"Ch3-g3",e:9.89}],"-1#-474219645":[{m:"Eg10-e8",e:9.904},{m:"g7-g6",e:9.231},{m:"a7-a6",e:9.904},{m:"g7-g6",e:8.571},{m:"Cb8-e8",e:9.904},{m:"Hb10-c8",e:9.904}],"-1#1068856501":[{m:"Hb10-c8",e:9},{m:"Hh10-g8",e:9}],"1#-43151368":[{m:"Hh1-g3",e:8.889}],"-1#-1294982608":[{m:"Hb10-c8",e:9.667},{m:"Ri10-h10",e:9.667}],"-1#1875566152":[{m:"Hb10-a8",e:9.375},{m:"Hb10-c8",e:9.375},{m:"Cb8-f8",e:9.375},{m:"Cb8-e8",e:9.375}],"1#626892362":[{m:"Ra1-b1",e:9.167}],"1#2128268532":[{m:"Ra1-b1",e:5}],"1#1564760504":[{m:"Ra1-b1",e:6.667}],"1#1516431840":[{m:"Hh1-g3",e:5}],"-1#1609740970":[{m:"Hb10-c8",e:8.571},{m:"Cb8-b4",e:8.571},{m:"Cb8-f8",e:8.571}],"1#1323474966":[{m:"Ra1-b1",e:8}],"-1#2018398442":[{m:"Ra10-b10",e:8}],"1#1077706355":[{m:"Eg1-e3",e:8},{m:"Rb1-b7",e:8}],"1#-499123282":[{m:"Ch3-e3",e:5}],"-1#-1196920246":[{m:"Hb10-c8",e:5}],"1#-1447534346":[{m:"Hh1-g3",e:5}],"-1#-435827394":[{m:"Ch8-e8",e:5}],"1#1836856666":[{m:"Ra1-a2",e:5}],"-1#-465715727":[{m:"Hb10-c8",e:5}],"1#-181555379":[{m:"Ra2-f2",e:5}],"-1#1192175201":[{m:"Af10-e9",e:5}],"-1#-329026054":[{m:"Ec10-e8",e:9.545},{m:"Hh10-g8",e:9.545},{m:"Ch8-e8",e:9.545},{m:"Cb8-e8",e:9.545},{m:"g7-g6",e:7.5},{m:"a7-a6",e:9.545},{m:"Eg10-e8",e:9.545}],"-1#715083929":[{m:"g7-g6",e:9.524},{m:"g7-g6",e:7.5},{m:"g7-g6",e:8.333}],"1#523724593":[{m:"Ra1-b1",e:8},{m:"Eg1-e3",e:8}],"-1#698062797":[{m:"Hb10-c8",e:7.5}],"1#948667761":[{m:"Cb3-d3",e:7.5},{m:"Ra1-b1",e:6.667}],"-1#39570058":[{m:"c7-c6",e:5}],"-1#-1716624925":[{m:"Ra10-a9",e:6.667},{m:"Hb10-c8",e:6.667}],"1#-2114455390":[{m:"a4-a5",e:5}],"1#-2000784545":[{m:"Ra1-b1",e:6.667}],"1#-397956140":[{m:"Ra1-a2",e:9},{m:"Eg1-e3",e:9},{m:"Hb1-a3",e:7.5}],"-1#1627792255":[{m:"Hb10-c8",e:5}],"-1#1860087046":[{m:"a7-a6",e:8.333}],"-1#-970387816":[{m:"Hh10-g8",e:8},{m:"Hg8-f6",e:9},{m:"Ch8-i8",e:9},{m:"Hb10-a8",e:9},{m:"Ri10-i9",e:9}],"1#1683544619":[{m:"Ha3-b5",e:5}],"-1#1627186002":[{m:"Cb8-e8",e:5}],"1#-70751125":[{m:"Ri1-i2",e:6.667},{m:"Ri1-h1",e:6.667}],"1#-1933685094":[{m:"Ha3-b5",e:5}],"-1#-2011531293":[{m:"Ra10-b10",e:5}],"1#-2021401860":[{m:"Ha3-b5",e:5}],"-1#-2094537851":[{m:"c7-c6",e:5}],"-1#2078073207":[{m:"Eg10-e8",e:5}],"1#-1199448696":[{m:"Hh1-i3",e:5}],"-1#-1592795722":[{m:"Hb10-c8",e:5}],"1#-1340092662":[{m:"Cb3-e3",e:5}],"-1#442456208":[{m:"Ra10-b10",e:5}],"1#573404681":[{m:"Ra1-b1",e:5}],"-1#344033013":[{m:"Cb8-b4",e:5}],"1#-1454583823":[{m:"Ri1-h1",e:5}],"1#341448494":[{m:"Ch3-e3",e:9.167},{m:"g4-g5",e:9.167},{m:"Hh1-g3",e:9.167}],"-1#1322098378":[{m:"Hh10-g8",e:8.571},{m:"Hb10-c8",e:8.571},{m:"Ch8-e8",e:8.571}],"1#-1944754809":[{m:"Hh1-g3",e:7.5}],"-1#-1012348849":[{m:"Ri10-h10",e:7.5}],"1#-1712736834":[{m:"Ri1-h1",e:7.5}],"-1#-1821053298":[{m:"Hb10-a8",e:7.5}],"1#1608354934":[{m:"Hh1-g3",e:6.667}],"-1#274735550":[{m:"g7-g6",e:6.667},{m:"Ri10-i9",e:6.667}],"1#1698354883":[{m:"Ri1-h1",e:5}],"1#765784049":[{m:"Hh1-g3",e:5}],"-1#1645822521":[{m:"Hh10-g8",e:5}],"1#-1597916812":[{m:"Ri1-h1",e:5}],"-1#-1436753340":[{m:"Hb10-a8",e:5}],"1#-523525562":[{m:"Rh1-h7",e:5}],"-1#1485955523":[{m:"Hb10-a8",e:8},{m:"Ch8-e8",e:8}],"1#302424513":[{m:"Hh1-g3",e:7.5}],"-1#1572539401":[{m:"Eg10-e8",e:7.5},{m:"Ra10-a9",e:7.5}],"1#-1629081354":[{m:"Cb3-e3",e:5}],"-1#883337068":[{m:"Ha8-b6",e:5}],"1#1172477256":[{m:"Eg1-e3",e:6.667}],"-1#-1015311462":[{m:"Hh10-g8",e:6.667}],"1#1006145784":[{m:"Hh1-g3",e:5}],"-1#1950694704":[{m:"Hh10-g8",e:5}],"1#-1231174019":[{m:"Ri1-h1",e:5}],"-1#-1140810419":[{m:"Hb10-a8",e:6.667}],"1#-157819569":[{m:"Ch3-i3",e:6.667},{m:"Ra1-a2",e:6.667}],"-1#1541913318":[{m:"g7-g6",e:5}],"1#784158107":[{m:"Eg1-e3",e:5}],"-1#-1474016439":[{m:"Hb10-a8",e:5}],"1#-491582645":[{m:"Af1-e2",e:5}],"-1#-1159011967":[{m:"Hh10-g8",e:5}],"1#2016549580":[{m:"Cb3-d3",e:6.667},{m:"Ri1-f1",e:6.667}],"-1#1122129207":[{m:"Ha8-b6",e:5}],"1#-953102088":[{m:"Ra1-a2",e:5}],"-1#1316051027":[{m:"Eg10-e8",e:5}],"1#-1926470484":[{m:"c4-c5",e:5}],"-1#1434354182":[{m:"Eg10-e8",e:5}],"1#-1776042247":[{m:"Rf1-f5",e:5}],"-1#53615606":[{m:"Ra10-a9",e:5}],"1#460030647":[{m:"a4-a5",e:5}],"1#634404228":[{m:"Hh1-g3",e:9.545},{m:"Ch3-e3",e:9.545}],"-1#1785565260":[{m:"Hb10-c8",e:9.524},{m:"g7-g6",e:9.524}],"1#2071823088":[{m:"Eg1-e3",e:9.474},{m:"Ra1-b1",e:9.474},{m:"Ch3-i3",e:9.474},{m:"Ra1-a2",e:9.474}],"-1#-35355614":[{m:"Hh10-g8",e:6.667},{m:"Hb10-c8",e:6.667}],"-1#1305571852":[{m:"Ra10-a9",e:8.333}],"-1#214322671":[{m:"Hh10-g8",e:5}],"1#-836847966":[{m:"Ri1-h1",e:5}],"-1#-230946213":[{m:"Ra10-b10",e:9.091},{m:"g7-g6",e:9.091}],"-1#2135405664":[{m:"Hb10-c8",e:6.667},{m:"Hh10-g8",e:6.667}],"1#1851238108":[{m:"Hh1-g3",e:5}],"-1#568986388":[{m:"Ch8-f8",e:8.571},{m:"Ra10-b10",e:8.571},{m:"Hh10-i8",e:8.571}],"1#-487370435":[{m:"Ri1-h1",e:5}],"-1#-395441651":[{m:"Hh10-g8",e:8.889}],"1#429401485":[{m:"Cb3-c3",e:8},{m:"Ra1-b1",e:8}],"1#-1450099480":[{m:"Ra1-b1",e:6.667}],"-1#-1623340012":[{m:"Ri10-h10",e:6.667}],"1#-981683739":[{m:"Cb3-c3",e:6.667}],"1#-1113632979":[{m:"Hh1-g3",e:5}],"-1#-232594715":[{m:"Hb10-c8",e:8},{m:"Ri10-h10",e:8}],"1#-483200935":[{m:"Ri1-h1",e:6.667}],"-1#-374363287":[{m:"Ra10-b10",e:8},{m:"Ri10-h10",e:8}],"1#-774011408":[{m:"Cb3-d3",e:5}],"1#-1276193128":[{m:"c4-c5",e:8.333}],"1#-1469866220":[{m:"Cb3-d3",e:8},{m:"Ra1-b1",e:8},{m:"Cb3-c3",e:8},{m:"Ra1-a2",e:8}],"1#-761204383":[{m:"Cb3-c3",e:9.333},{m:"Cb3-d3",e:9.333},{m:"Hh1-g3",e:9.333},{m:"g4-g5",e:9.333}],"-1#-666316168":[{m:"Cb8-e8",e:6.667},{m:"Hb10-a8",e:6.667}],"1#-304028208":[{m:"Hh1-g3",e:5}],"-1#-1570945000":[{m:"Hb10-c8",e:5}],"1#-1286776156":[{m:"Ra1-b1",e:5}],"-1#-2048808360":[{m:"e7-e6",e:5}],"1#657710895":[{m:"Af1-e2",e:5}],"1#-1830841734":[{m:"Ch3-e3",e:5}],"-1#-934798434":[{m:"Ra10-b10",e:5}],"1#-264620793":[{m:"Hh1-g3",e:5}],"-1#-1081632561":[{m:"Ri10-h10",e:5}],"1#-439950018":[{m:"Ri1-h1",e:5}],"-1#-279200242":[{m:"Ch8-h4",e:5}],"-1#-395264358":[{m:"a7-a6",e:5}],"1#-330128488":[{m:"Ra1-b1",e:5}],"-1#-620866716":[{m:"Hb10-a8",e:5}],"1#-1872161946":[{m:"Ch3-e3",e:5}],"-1#-889283966":[{m:"Ri10-h10",e:5}],"1#-1866471565":[{m:"Hh1-g3",e:5}],"-1#-553497925":[{m:"Ra10-b10",e:5}],"1#-412064734":[{m:"Ri1-h1",e:5}],"-1#-303218926":[{m:"Ch8-h4",e:5}],"1#-932969352":[{m:"g4-g5",e:5}],"-1#-2068843883":[{m:"Ad10-e9",e:5}],"1#1752091236":[{m:"Hg3-f5",e:5}],"-1#1050450179":[{m:"Cb8-b4",e:5}],"-1#-1659020119":[{m:"g7-g6",e:7.5},{m:"Cb8-a8",e:7.5}],"1#1411346281":[{m:"Eg1-e3",e:5}],"-1#-762943045":[{m:"Eg10-e8",e:5}],"1#299586884":[{m:"Ri1-h1",e:5}],"-1#457576052":[{m:"c7-c6",e:5}],"1#-668863153":[{m:"Ra1-b1",e:5}],"-1#-292747853":[{m:"Hb10-c8",e:5}],"-1#-1637152884":[{m:"c7-c6",e:9.091},{m:"Hb10-c8",e:9.091},{m:"Ch8-i8",e:9.091},{m:"Ec10-e8",e:9.091},{m:"a7-a6",e:9.091},{m:"Cb8-e8",e:9.091}],"1#1561132215":[{m:"Hh1-g3",e:7.5}],"1#-1887759056":[{m:"Hh1-g3",e:5}],"1#-1551211137":[{m:"Hh1-g3",e:6.667}],"1#-1292302481":[{m:"Hh1-g3",e:5}],"1#-1706485106":[{m:"Hh1-g3",e:5}],"1#-1413271516":[{m:"Ch3-e3",e:6.667}],"1#126591969":[{m:"g4-g5",e:5}],"-1#1262507276":[{m:"Hh10-g8",e:5}],"1#-1986482623":[{m:"Hh1-g3",e:5}],"-1#-970652791":[{m:"Ri10-h10",e:5}],"1#-1671135624":[{m:"Ri1-h1",e:5}],"-1#-1762056888":[{m:"Rh10-h6",e:5}],"1#858692626":[{m:"Ch3-i3",e:5}],"-1#1150636813":[{m:"Rh6-d6",e:5}],"1#-273901442":[{m:"Ad1-e2",e:5}],"-1#-1599764098":[{m:"Hb10-a8",e:5}],"1#-365770372":[{m:"Cb3-f3",e:5}],"-1#-1889761773":[{m:"Ra10-b10",e:5}],"1#-1221678966":[{m:"Ec1-e3",e:5}],"-1#97011363":[{m:"a7-a6",e:5}],"1#32136097":[{m:"Hg3-f5",e:5}],"-1#1461192902":[{m:"Rd6-d5",e:5}],"1#-804555091":[{m:"Hf5xg7",e:5}],"-1#-1830164378":[{m:"Cb8-b4",e:5}],"1#790929762":[{m:"c4-c5",e:5}],"-1#-533226006":[{m:"Rd5-d4",e:5}],"1#-1674042809":[{m:"Rh1-h4",e:5}],"-1#-526074367":[{m:"Ec10-e8",e:5}],"1#-868827422":[{m:"Ha3-c2",e:5}],"-1#220651907":[{m:"Rd4-d2",e:5}],"1#-1915888350":[{m:"Hc2xb4",e:5}],"-1#-1471102351":[{m:"Rb10xb4",e:5}],"1#1935480977":[{m:"Cf3-f9",e:5}],"-1#1863008042":[{m:"Ha8-b6",e:5}],"1#-354829595":[{m:"Hg7xe8",e:5}],"-1#-1567251486":[{m:"Cd8-b8",e:5}],"1#566853771":[{m:"He8-g9",e:5}],"-1#1814743511":[{m:"Ke10-e9",e:5}],"1#1302786674":[{m:"Cf9-f2",e:5}],"-1#1387425304":[{m:"Rd2-d6",e:5}],"1#692425599":[{m:"Rh4-f4",e:5}],"-1#-1839491745":[{m:"Rb4-b1+",e:5}],"1#-474207518":[{m:"Ra1xb1",e:5}],"-1#513010428":[{m:"Cb8xb1",e:5}],"1#-170811570":[{m:"e4-e5",e:5}],"-1#1918794242":[{m:"Cb1-b5",e:5}],"1#-155575037":[{m:"e5-e6",e:5}],"-1#2086136494":[],"1#1021971151":[{m:"Ch3-d3",e:5}],"-1#-1079501033":[{m:"Hh10-g8",e:5}],"1#2104550490":[{m:"Hh1-g3",e:5}],"-1#852314514":[{m:"Ri10-h10",e:5}],"1#1754018915":[{m:"Ri1-i2",e:5}],"-1#1036548107":[{m:"Ch8-i8",e:5}],"1#2693880":[{m:"Ri2-f2",e:5}],"-1#217895042":[{m:"Rh10-h6",e:5}],"1#-1456772648":[{m:"Rf2-f5",e:5}],"-1#1429923198":[{m:"Hb10-c8",e:5}],"1#1143666626":[{m:"Ec1-e3",e:5}],"-1#-154396181":[{m:"c7-c6",e:5}],"1#900457168":[{m:"Rf5-d5",e:5}],"-1#211152684":[{m:"Ad10-e9",e:5}],"1#-531310627":[{m:"Ad1-e2",e:5}],"-1#-1352808739":[{m:"a7-a6",e:5}],"1#-1417684001":[{m:"Cb3-b1",e:5}],"-1#137555358":[{m:"Cb8-a8",e:5}],"1#-1053761954":[{m:"Rd5-b5",e:5}],"-1#1712600449":[{m:"Ca8xa4",e:5}],"1#-1305910364":[{m:"Ha3-c2",e:5}],"-1#1933130949":[{m:"a6-a5",e:5}],"1#-1018975431":[{m:"Rb5-d5",e:5}],"-1#1684488422":[{m:"g7-g6",e:5}],"1#289257371":[{m:"c4-c5",e:5}],"-1#-567375085":[{m:"Hc8-a7",e:5}],"1#-601315796":[{m:"Hc2-b4",e:5}],"-1#-143378111":[{m:"Rh6-h4",e:5}],"1#-1958782915":[{m:"c5xc6",e:5}],"-1#-1263787031":[{m:"Ha7xc6",e:5}],"1#-280238387":[{m:"Rd5-c5",e:5}],"-1#262178303":[{m:"Hc6-d8",e:5}],"1#-784089883":[{m:"Hb4-d5",e:5}],"-1#1556764097":[{m:"Hd8-e6",e:5}],"1#-708485708":[{m:"Rc5-c4",e:5}],"-1#1712833712":[{m:"Rh4xg4",e:5}],"1#126033591":[{m:"Rc4-c9",e:5}],"-1#1687527386":[{m:"Ra10-b10",e:5}],"1#1558688067":[{m:"Cb1-b4",e:5}],"-1#1514124240":[{m:"He6-d4",e:5}],"1#1358600672":[{m:"Rc9-c5",e:5}],"-1#-1646020872":[{m:"Rb10-a10",e:5}],"1#-1517184927":[{m:"Cb4-c4",e:5}],"-1#-154010682":[{m:"g6-g5",e:5}],"1#-1891623567":[{m:"Ra1-b1",e:5}],"-1#-1175655027":[{m:"g5-f5",e:5}],"1#-1004624234":[{m:"Hd5-c7",e:5}],"-1#-631531792":[{m:"f5-f4",e:5}],"1#-759210622":[{m:"Hc7-d9",e:5}],"1#1930525463":[{m:"Hh1-g3",e:9.756},{m:"Ch3-e3",e:9.756}],"-1#1017960159":[{m:"g7-g6",e:9.722},{m:"Hh10-g8",e:9.722}],"1#1240867234":[{m:"Ri1-h1",e:5}],"-1#1131117202":[{m:"Hh10-g8",e:5}],"1#-2118942241":[{m:"Ra1-a2",e:8.333},{m:"Ch3-i3",e:8.333}],"-1#150079860":[{m:"Cb8-b4",e:8.571},{m:"Hb10-c8",e:8.571},{m:"Ri10-h10",e:8.571}],"-1#-167227712":[{m:"Hb10-c8",e:5}],"1#-417833860":[{m:"Ad1-e2",e:6.667},{m:"c4-c5",e:6.667}],"-1#-1475261060":[{m:"c7-c6",e:5}],"1#-25940590":[{m:"Ra1-a2",e:9.714},{m:"Ri1-h1",e:9.714},{m:"g4-g5",e:9.714}],"-1#2000004409":[{m:"Ri10-h10",e:5}],"1#762632392":[{m:"Ri1-h1",e:5}],"-1#669615096":[{m:"Cb8-c8",e:7.5}],"-1#-186026334":[{m:"Hh10-g8",e:5},{m:"a7-a6",e:9.697}],"-1#-1296049281":[{m:"Ri10-h10",e:5}],"1#-385964402":[{m:"Ri1-h1",e:5}],"-1#-496763458":[{m:"Rh10-h6",e:7.5}],"-1#696709875":[{m:"Hh10-g8",e:8.333}],"1#-346158658":[{m:"Hh1-g3",e:8.333}],"-1#-1528585098":[{m:"Ri10-i9",e:8.889},{m:"Hb10-c8",e:8.889},{m:"Ri10-h10",e:8.889}],"1#-448172014":[{m:"Ri1-h1",e:8.333},{m:"Cb3-c3",e:8.333}],"-1#-271307998":[{m:"Hb10-a8",e:9.811},{m:"Ri10-i9",e:8.333}],"-1#-274640117":[{m:"Hb10-a8",e:7.5}],"1#-1523182839":[{m:"Ra1-b1",e:7.5}],"1#-1242319158":[{m:"c4-c5",e:6.667},{m:"Ri1-h1",e:6.667}],"-1#2061535810":[{m:"Ri10-h10",e:6.667},{m:"g7-g6",e:6.667}],"-1#-1083249158":[{m:"a7-a6",e:8.333},{m:"Ri10-i9",e:8.333}],"1#-22881913":[{m:"Ri1-i2",e:8.333},{m:"Hb1-a3",e:5}],"-1#-1410951697":[{m:"a7-a6",e:8.571},{m:"Hb10-a8",e:8.571},{m:"Af10-e9",e:8.571},{m:"Cb8-b4",e:8.571}],"-1#-196412770":[{m:"Hb10-a8",e:6.667},{m:"Cb8-d8",e:6.667}],"1#-1092765028":[{m:"Ra1-b1",e:5}],"-1#-2005841312":[{m:"Ra10-b10",e:5}],"1#-1341954823":[{m:"Rb1-b5",e:5}],"-1#-391293246":[{m:"a7-a6",e:5}],"1#-326153280":[{m:"g4-g5",e:5}],"-1#-1606107859":[{m:"Rh10-h6",e:5}],"1#93521015":[{m:"Cc3xc7",e:5}],"-1#-51096907":[{m:"Ha8-b6",e:5}],"1#2032588666":[{m:"Cc7-b7",e:6.667}],"-1#416762745":[{m:"Cb8-a8",e:6.667},{m:"Cb8-c8",e:6.667}],"1#-774539079":[{m:"Cb7xg7",e:5}],"-1#359631557":[{m:"Eg10-i8",e:5}],"1#-1809252069":[{m:"Cb7-c7",e:5}],"-1#-170353384":[{m:"Ha8-b6",e:5}],"1#-1727041939":[{m:"Ra1-b1",e:5}],"-1#-1348231535":[{m:"Hb10-a8",e:5}],"1#-449519981":[{m:"a4-a5",e:5}],"-1#-883262497":[{m:"Rh10-h4",e:5}],"1#253465736":[{m:"Ri1-h1",e:5}],"-1#92721080":[{m:"Rh4xg4",e:5}],"1#1678906815":[{m:"Rb1-b5",e:5}],"-1#1018963844":[{m:"Cd8-d3",e:5}],"1#1523158924":[{m:"Rh1-h3",e:5}],"-1#1124226505":[{m:"g7-g6",e:5}],"1#911778484":[{m:"Ad1-e2",e:5}],"-1#2035397556":[{m:"Cd3xa3",e:5}],"1#144350996":[{m:"Ce3xa3",e:5}],"-1#1302810106":[{m:"Ra10-b10",
e:5}],"1#1976918883":[{m:"Rb5xb10",e:5}],"1#-752535853":[{m:"Cb3-d3",e:5}],"-1#-369788632":[{m:"Hb10-a8",e:6.667},{m:"Ra10-a9",e:6.667}],"1#-1553843926":[{m:"Ra1-b1",e:5}],"-1#-1781610026":[{m:"Ra10-b10",e:5}],"1#-1380128945":[{m:"Ch3-e3",e:5}],"-1#-148148565":[{m:"Hh10-g8",e:5}],"1#905156070":[{m:"Hh1-g3",e:5}],"-1#2051946542":[{m:"Af10-e9",e:5}],"1#1994783932":[{m:"Ri1-h1",e:5}],"-1#2088281996":[{m:"Ch8-i8",e:5}],"1#1100596607":[{m:"g4-g5",e:5}],"-1#223490962":[{m:"Ri10-f10",e:5}],"1#-2071559082":[{m:"Rb1-b5",e:5}],"-1#-601311635":[{m:"Cb8-d8",e:5}],"1#-1318247778":[{m:"Rb5-d5",e:5}],"-1#-1687427876":[{m:"Cd8xd3",e:5}],"1#-1966417279":[{m:"Rd5xd3",e:5}],"-1#618764428":[{m:"Rf10-h10",e:5}],"1#-357997112":[{m:"Rh1xh10+",e:5}],"-1#266039617":[{m:"Hg8xh10",e:5}],"1#1404979880":[{m:"Rd3-d6",e:5}],"-1#-1040775220":[{m:"Rb10-b5",e:5}],"1#-277921188":[{m:"Eg1-i3",e:5}],"-1#420250607":[{m:"Ci8-f8",e:5}],"1#-97940412":[{m:"Ce3xe7",e:5}],"1#-240328599":[{m:"a4-a5",e:5}],"-1#-540916443":[{m:"Ra9-d9",e:5}],"1#-1336780666":[{m:"Af1-e2",e:5}],"-1#-401886644":[{m:"Rd9-d6",e:5}],"1#803079306":[{m:"Ra1-b1",e:5}],"-1#426964086":[{m:"Hb10-a8",e:5}],"1#1407562868":[{m:"Hh1-g3",e:5}],"-1#475535804":[{m:"a7-a6",e:5}],"1#410649790":[{m:"a5xa6",e:5}],"-1#-1893272751":[{m:"Rd6xa6",e:5}],"1#1228813069":[{m:"Rb1-b7",e:5}],"-1#1776982190":[{m:"Cb8-d8",e:5}],"1#78580829":[{m:"Eg1-e3",e:5}],"-1#-2110387569":[{m:"Hh10-g8",e:5}],"1#1089401282":[{m:"Ri1-f1",e:5}],"-1#1839360264":[{m:"Ch8-i8",e:5}],"1#1346571259":[{m:"g4-g5",e:5}],"-1#478739734":[{m:"Ri10-h10",e:5}],"1#1187610855":[{m:"Ch3-i3",e:5}],"-1#829575160":[{m:"g7-g6",e:5}],"1#1143519365":[{m:"Rb7-b5",e:5}],"-1#563025516":[{m:"Af10-e9",e:5}],"1#757388030":[{m:"Ci3-i1",e:5}],"-1#1791555867":[{m:"Hb10-c8",e:9.929},{m:"Ra10-a8",e:9.929},{m:"Hh10-g8",e:9.929},{m:"c7-c6",e:9.929},{m:"Ra10-a9",e:9.929},{m:"Hb10-a8",e:9.929},{m:"Cb8-e8",e:9.929},{m:"Cb8-g8",e:9.929},{m:"Cb8-f8",e:9.929},{m:"Eg10-e8",e:9.929},{m:"g7-g6",e:9.929}],"1#2077813671":[{m:"Hb1-c3",e:9.839},{m:"c4-c5",e:9.839}],"-1#696287466":[{m:"Ra10-b10",e:9.808},{m:"Hb10-c8",e:7.5},{m:"Hb10-c8",e:9.583}],"1#301117043":[{m:"Ec1-e3",e:9.778},{m:"Hh1-i3",e:9.778},{m:"Hb1-c3",e:8.889},{m:"g4-g5",e:9.778},{m:"Ra1-b1",e:9.778}],"-1#-1558953894":[{m:"g7-g6",e:5}],"1#-699484377":[{m:"Hh1-i3",e:5}],"-1#142388813":[{m:"i7-i6",e:7.5},{m:"Hh10-i8",e:7.5}],"-1#-555642117":[{m:"g7-g6",e:9.697},{m:"Cb8-a8",e:9.697}],"1#-1413782138":[{m:"Eg1-e3",e:9.231},{m:"Hh1-i3",e:9.231},{m:"Ec1-e3",e:9.231}],"1#400793915":[{m:"Hh1-i3",e:9.583},{m:"Ra1-a2",e:9.583},{m:"Hh1-g3",e:9.583},{m:"Eg1-e3",e:9.583}],"-1#1564039326":[{m:"Ra10-b10",e:7.5},{m:"Cb8-a8",e:8.75}],"1#-1637964891":[{m:"Hh1-g3",e:8.75}],"-1#-773648787":[{m:"Hh10-i8",e:9.231}],"-1#660496015":[{m:"Ra10-b10",e:9.5},{m:"Cb8-b4",e:9}],"1#-465984076":[{m:"Rb1-b7",e:9.565},{m:"Rb1-b5",e:9.565}],"1#1557821335":[{m:"c4-c5",e:6.667},{m:"Ra1-b1",e:6.667}],"-1#-1815524577":[{m:"Hh10-g8",e:8.333},{m:"g7-g6",e:9.697}],"1#1360113746":[{m:"Ra1-b1",e:6.667}],"-1#1740456110":[{m:"Ra10-b10",e:6.667}],"1#1607429687":[{m:"Eg1-e3",e:8.889},{m:"Hh1-i3",e:8.889},{m:"Ch3-h7",e:8.889}],"-1#1786152811":[{m:"Ra10-b10",e:5}],"1#1376037362":[{m:"Rb1-b5",e:5}],"-1#178953161":[{m:"Hh10-g8",e:5}],"1#-932028284":[{m:"g4-g5",e:5}],"-1#-2068212119":[{m:"g6xg5",e:5}],"1#511532638":[{m:"Rb5xg5",e:5}],"-1#300391578":[{m:"Ch8-h9",e:5}],"1#1234501273":[{m:"Ch3-g3",e:5}],"-1#1466622655":[{m:"Ch9-g9",e:5}],"1#-353928239":[{m:"Hh1-g3",e:9.615},{m:"Ra1-b1",e:9.615},{m:"Hh1-i3",e:9.615},{m:"g4-g5",e:9.615}],"-1#-1520773607":[{m:"Ra10-b10",e:5}],"1#-1658259328":[{m:"Ch3-i3",e:5}],"-1#-359450721":[{m:"Ch8-g8",e:5}],"1#-1670899371":[{m:"Ri1-h1",e:5}],"-1#-599028947":[{m:"Ra10-b10",e:9.5}],"-1#-211190801":[{m:"Ra10-b10",e:6.667}],"1#-887401098":[{m:"Ec1-e3",e:6.667},{m:"Ri1-i2",e:6.667}],"-1#-1507029700":[{m:"Ra10-b10",e:7.5}],"-1#-1261709521":[{m:"g7-g6",e:9.091},{m:"Ra10-b10",e:9.091}],"1#-1047453614":[{m:"c4-c5",e:6.667}],"1#-1933968970":[{m:"Hb1-c3",e:8.889}],"1#-1278236221":[{m:"Hb1-c3",e:5}],"-1#-510147954":[{m:"Cb8-g8",e:5}],"1#-393430857":[{m:"Af1-e2",e:7.5},{m:"Ra1-b1",e:7.5}],"-1#-1328196995":[{m:"Ra8-f8",e:5}],"1#-1222209373":[{m:"Ra1-b1",e:5}],"-1#-2121637793":[{m:"Hb10-c8",e:7.5}],"1#-1868926237":[{m:"c4-c5",e:7.5},{m:"Rb1-b5",e:7.5}],"-1#1602834027":[{m:"g7-g6",e:5}],"1#718518550":[{m:"Hh1-i3",e:5}],"-1#861780264":[{m:"i7-i6",e:5}],"1#1018198007":[{m:"Eg1-e3",e:5}],"-1#-1171689179":[{m:"Cg8-g9",e:5}],"1#-779301906":[{m:"Ch3-h2",e:5}],"-1#-1903767993":[{m:"Hh10-g8",e:5}],"1#1281242378":[{m:"Ch2-f2",e:5}],"-1#-746336796":[{m:"Rf8-d8",e:5}],"1#1620080695":[{m:"Ri1-h1",e:5}],"-1#1779245831":[{m:"Ch8-h6",e:5}],"1#1371822085":[{m:"Rb1-b8",e:5}],"-1#2020114111":[{m:"i6-i5",e:5}],"1#-1092765086":[{m:"i4xi5",e:5}],"-1#-673935247":[{m:"Ri10xi5",e:5}],"1#-831747992":[{m:"Rh1-h3",e:5}],"-1#-676900307":[{m:"Cg9-h9",e:5}],"1#-844021965":[{m:"Rh3-g3",e:5}],"-1#1036162997":[{m:"Hg8-i7",e:5}],"1#-561893950":[{m:"Cf2-i2",e:5}],"-1#1762462071":[{m:"Hi7-h5",e:5}],"1#1105595236":[{m:"Ci2xi5",e:5}],"-1#284980143":[{m:"Hh5xg3",e:5}],"1#384920459":[{m:"Hc3-b5",e:5}],"-1#1607697895":[{m:"g6-g5",e:5}],"1#641885008":[{m:"Hb5xa7",e:5}],"-1#819558585":[{m:"Rd8-i8",e:5}],"1#-702137436":[{m:"Rb8xc8",e:5}],"-1#1861587813":[{m:"Eg10-e8",e:5}],"1#-1381453926":[{m:"Rc8xc7",e:5}],"-1#1809479034":[{m:"Ri8xi5",e:5}],"1#-304287780":[{m:"Rc7xe7",e:5}],"-1#-1346956542":[{m:"Ch9-i9",e:5}],"-1#-936099624":[{m:"Hh10-i8",e:6.667}],"1#1078949668":[{m:"i4-i5",e:6.667}],"-1#-28283068":[{m:"Rf8-f6",e:6.667},{m:"Cg8xg4",e:6.667}],"1#1627557320":[{m:"Hh1-i3",e:5}],"-1#2022477302":[{m:"Ch8-h4",e:5}],"1#1560655516":[{m:"Hi3-h5",e:5}],"-1#984960235":[{m:"Rf6-d6",e:5}],"1#-690865868":[{m:"Rb5-f5",e:5}],"-1#1523135599":[{m:"Af10-e9",e:5}],"1#1449324797":[{m:"Eg1-e3",e:5}],"-1#-788793809":[{m:"Cg8xg4",e:5}],"1#-1706866557":[{m:"c4-c5",e:5}],"-1#1431335947":[{m:"Eg10-e8",e:5}],"1#-1777514252":[{m:"Rf5-f6",e:5}],"-1#392037812":[{m:"c7-c6",e:5}],"1#-734396785":[{m:"c5xc6",e:5}],"-1#-341146277":[{m:"Rd6xc6",e:5}],"1#-71579562":[{m:"a4-a5",e:5}],"1#-1259810328":[{m:"Ec1-e3",e:5}],"-1#101597121":[{m:"Eg10-e8",e:5}],"1#-984415426":[{m:"Ch3-h5",e:5}],"-1#-1257484995":[{m:"Rf8-f4",e:5}],"1#2073444153":[{m:"Ch5-h4",e:5}],"-1#-489632521":[{m:"Cg4-g6",e:5}],"1#447395572":[{m:"Ch4-h5",e:5}],"-1#-2081667782":[{m:"Af10-e9",e:5}],"1#-1891139160":[{m:"Hh1-i3",e:5}],"-1#-1765178986":[{m:"Cg6-e6",e:5}],"1#1341912205":[{m:"Rb5-e5",e:5}],"-1#507243839":[{m:"g7-g6",e:5}],"1#1801525826":[{m:"Ri1-i2",e:5}],"-1#1042634282":[{m:"Ri10-g10",e:5}],"1#-1717719453":[{m:"Ri2-g2",e:5}],"-1#-568309685":[{m:"Ra8-f8",e:6.667}],"1#-640447851":[{m:"Ra1-b1",e:5}],"1#-1475345834":[{m:"Hb1-c3",e:5}],"-1#-95917797":[{m:"c7-c6",e:5}],"1#959418912":[{m:"Ra1-b1",e:5}],"-1#260268764":[{m:"Ra10-a8",e:5}],"1#-695979516":[{m:"Eg1-e3",e:5}],"-1#1344091350":[{m:"Hb10-c8",e:5}],"1#1091380842":[{m:"Rb1-b5",e:5}],"-1#430117969":[{m:"Ch8-h9",e:5}],"1#1104180818":[{m:"g4-g5",e:5}],"-1#219906239":[{m:"Ch9-c9",e:5}],"1#-1122811750":[{m:"Af1-e2",e:5}],"-1#-448091568":[{m:"c6-c5",e:5}],"1#1801486385":[{m:"Rb5-b7",e:5}],"-1#247934680":[{m:"c5xc4",e:5}],"1#1094734939":[{m:"Hc3-a2",e:5}],"-1#433332395":[{m:"Hc8-d6",e:5}],"1#862358312":[{m:"Rb7-c7",e:5}],"-1#-910439738":[{m:"Cb8-c8",e:5}],"1#1162182820":[{m:"Rc7-d7",e:5}],"-1#1957125998":[{m:"Hd6xe4",e:5}],"1#1982365507":[{m:"Cf3-f8",e:5}],"-1#-1110305948":[{m:"Ec10-e8",e:5}],"1#-1858071673":[{m:"Cf8xc8",e:5}],"-1#573299660":[{m:"Ra8xc8",e:5}],"1#1373101406":[{m:"Ch3-f3",e:5}],"-1#1955302375":[{m:"Ri10-h10",e:5}],"1#785053206":[{m:"Hh1-i3",e:5}],"-1#927266344":[{m:"Rh10-h3",e:5}],"1#-1617057196":[{m:"Cf3-f8",e:5}],"-1#-446743309":[{m:"Rc8-c6",e:5}],"1#-864766845":[{m:"Rd7xe7",e:5}],"-1#-1574919962":[{m:"c4-d4",e:5}],"1#1742416273":[{m:"Re7xg7",e:5}],"-1#38277773":[{m:"Ad10-e9",e:5}],"1#-293000580":[{m:"Cf8-f4",e:5}],"-1#-2066549586":[{m:"He4-f6",e:5}],"1#-66297126":[{m:"Cf4-f5",e:5}],"-1#334202042":[{m:"Rc6-c5",e:5}],"1#1209713622":[{m:"g5-g6",e:5}],"-1#706104517":[{m:"Ee8xg6",e:5}],"1#-1448148448":[{m:"Hb1-c3",e:9.583}],"-1#-67671699":[{m:"Cb8-f8",e:9.583},{m:"Hb10-c8",e:9.583}],"1#-914755939":[{m:"Hh1-g3",e:8},{m:"Ra1-b1",e:8}],"-1#-2033958059":[{m:"Hb10-c8",e:5}],"1#-1747693079":[{m:"Hh1-g3",e:8.333}],"-1#-1585929963":[{m:"Hh10-g8",e:8},{m:"Hh10-i8",e:8}],"1#1671453272":[{m:"g4-g5",e:5}],"-1#795585717":[{m:"Eg10-e8",e:5}],"1#-331968438":[{m:"Eg1-e3",e:5}],"-1#1789892248":[{m:"Ra10-b10",e:5}],"1#688101097":[{m:"Rb1-b5",e:7.5},{m:"g4-g5",e:7.5}],"-1#1907205330":[{m:"Ra10-b10",e:6.667}],"-1#-2810271":[{m:"c7-c6",e:6.667}],"1#-289076003":[{m:"Hh1-g3",e:8.333},{m:"Hh1-i3",e:8.333},{m:"i4-i5",e:8.333}],"-1#-146076445":[{m:"i7-i6",e:5}],"1#-123289028":[{m:"Ch3-g3",e:5}],"-1#-430383590":[{m:"Hh10-i8",e:5}],"1#1847847398":[{m:"Ri1-h1",e:5}],"-1#1690219222":[{m:"Ri10-h10",e:5}],"1#1056952103":[{m:"Rh1-h5",e:5}],"-1#-1372307057":[{m:"Ch8-h6",e:5}],"1#-1778566515":[{m:"Ad1-e2",e:5}],"-1#-621532275":[{m:"Ch6-g6",e:5}],"1#-186151942":[{m:"Rh5xh10",e:5}],"-1#1356469437":[{m:"Hh10-i8",e:5}],"1#-660528319":[{m:"Hh1-i3",e:5}],"-1#-1053875329":[{m:"Ec10-e8",e:5}],"1#-306371684":[{m:"Eg1-e3",e:5}],"-1#1797530958":[{m:"Ri10-i9",e:5}],"1#714010922":[{m:"Ch3-g3",e:5}],"-1#879815948":[{m:"Ch8-g8",e:5}],"1#1116455878":[{m:"Ri1-h1",e:5}],"-1#1209440502":[{m:"Ra10-a9",e:5}],"1#1922130010":[{m:"Hb1-c3",e:9.286},{m:"Ad1-e2",e:9.286}],"-1#550046487":[{m:"Ra9-f9",e:9.231},{m:"Ra10-a9",e:6.667},{m:"Cb8-e8",e:9.231}],"1#-404814951":[{m:"Af1-e2",e:8.333},{m:"Hh1-g3",e:8.333},{m:"Hb1-c3",e:5}],"-1#-1081677485":[{m:"Cb8-e8",e:6.667}],"1#-1976639749":[{m:"Ra1-b1",e:6.667}],"-1#-1132319225":[{m:"Hb10-c8",e:6.667}],"-1#-1469927855":[{m:"Cb8-e8",e:5}],"1#-1647666695":[{m:"Ra1-b1",e:5}],"-1#-1462365543":[{m:"Cb8-e8",e:7.5},{m:"Hh10-g8",e:7.5}],"1#-1652677327":[{m:"Ec1-e3",e:6.667},{m:"Ra1-b1",e:6.667}],"-1#798542616":[{m:"Hb10-c8",e:5}],"1#1049156004":[{m:"Hh1-i3",e:5}],"-1#654760346":[{m:"Hh10-g8",e:5}],"-1#-1412246067":[{m:"Hb10-c8",e:5}],"1#-1161640079":[{m:"Rb1-b5",e:5}],"-1#-496175798":[{m:"Hh10-g8",e:5}],"1#1779362260":[{m:"Ra1-b1",e:5}],"-1#1554127144":[{m:"Hb10-a8",e:5}],"1#372594986":[{m:"Rb1-b6",e:5}],"-1#2086659543":[{m:"Cb8-c8",e:5}],"1#-257839179":[{m:"g4-g5",e:5}],"-1#-1133881000":[{m:"Rf9-f4",e:5}],"1#1934305429":[{m:"Hh1-i3",e:5}],"1#-476825624":[{m:"Ra1-b1",e:8.889},{m:"Hh1-i3",e:8.889}],"-1#-717699308":[{m:"Ra9-f9",e:8.75},{m:"a7-a6",e:8.75},{m:"Hb10-a8",e:8.75}],"1#305057690":[{m:"Af1-e2",e:8.333},{m:"Ad1-e2",e:8.333}],"-1#1249322320":[{m:"Hb10-a8",e:5}],"-1#1562893978":[{m:"Hb10-a8",e:8}],"1#397450904":[{m:"c4-c5",e:8}],"1#-786769386":[{m:"Rb1-b5",e:5}],"-1#-1984632787":[{m:"Ra9-f9",e:5}],"1#1319297187":[{m:"Af1-e2",e:5}],"-1#385550953":[{m:"Hb10-a8",e:5}],"1#1550600811":[{m:"Hh1-i3",e:5}],"1#-1615886570":[{m:"Hh1-i3",e:5}],"-1#-2044623064":[{m:"a7-a6",e:5}],"1#-2113693142":[{m:"Ad1-e2",e:5}],"-1#-854947030":[{m:"Ra9-f9",e:5}],"1#169640868":[{m:"Ch3-g3",e:7.5}],"-1#-98945066":[{m:"Ra9-f9",e:5}],"1#1024212824":[{m:"Ad1-e2",e:5}],"-1#1912942168":[{m:"Hb10-a8",e:5}],"1#949120602":[{m:"Ch3-g3",e:5}],"-1#644641404":[{m:"a7-a6",e:5}],"1#575565694":[{m:"a4-a5",e:5}],"-1#203475506":[{m:"a6xa5",e:5}],"1#647233197":[{m:"Ra1xa5",e:5}],"-1#-64672113":[{m:"i7-i6",e:5}],"1#-204939184":[{m:"i4-i5",e:5}],"-1#1305999408":[{m:"i6xi5",e:5}],"1#1871562555":[{m:"Hi3-h5",e:5}],"-1#138231116":[{m:"g7-g6",e:5}],"1#2103953969":[{m:"Cf3-f5",e:5}],"-1#1674752073":[{m:"Hh10-g8",e:5}],"1#-1593160956":[{m:"Cg3-f3",e:5}],"-1#-2022361366":[{m:"Rf9-d9",e:5}],"1#841880758":[{m:"Cf5xi5",e:5}],"1#358694079":[{m:"Ra1-b1",e:5}],"-1#600689731":[{m:"Ra10-a9",e:9.615}],"1#853401343":[{m:"Rb1-b5",e:9},{m:"Rb1-b7",e:9},{m:"c4-c5",e:9},{m:"g4-g5",e:9}],"-1#302609756":[{m:"Ra9-f9",e:7.5}],"-1#-36773257":[{m:"Ra9-f9",e:6.667}],"-1#1033400666":[{m:"Ra9-f9",e:5}],"1#-91325996":[{m:"Hb1-c3",e:5}],"1#543144217":[{m:"Hb1-c3",e:5}],"-1#1913115220":[{m:"Ra10-b10",e:5}],"1#1249246413":[{m:"Ra1-b1",e:5}],"-1#2094599217":[{m:"Cb8-b4",e:5}],"1#-1055636171":[{m:"c4-c5",e:5}],"-1#235370941":[{m:"Cb4-c4",e:5}],"1#1866414324":[{m:"Hh1-i3",e:5}],"-1#1991325898":[{m:"Ch8-e8",e:5}],"1#366496241":[{m:"Ch3-h4",e:5}],"-1#-518208691":[{m:"Hh10-g8",e:5}],"1#600061952":[{m:"Ec1-e3",e:5}],"-1#-1859987927":[{m:"Rb10xb1",e:5}],"1#1561243128":[{m:"Hc3xb1",e:5}],"-1#-992610729":[{m:"Ri10-h10",e:5}],"1#-1634432090":[{m:"Hi3-g2",e:5}],"-1#-351824774":[{m:"Rh10-h6",e:5}],"1#1322265888":[{m:"Hb1-c3",e:5}],"-1#478692973":[{m:"a7-a6",e:5}],"1#413817711":[{m:"Ri1-h1",e:5}],"-1#305594463":[{m:"Cc4xg4",e:5}],"1#-1866662922":[{m:"i4-i5",e:5}],"-1#782492566":[{m:"Ha8-b6",e:5}],"1#-1418631591":[{m:"Hg2-i3",e:5}],"-1#-555583099":[{m:"Cg4-g3",e:5}],"1#1387793289":[{m:"Ch4-g4",e:5}],"-1#-817012337":[{m:"g7-g6",e:5}],"1#-1172859150":[{m:"Rh1xh6",e:5}],"-1#-1352389877":[{m:"Hg8xh6",e:5}],"1#-467983237":[{m:"Hi3-h5",e:5}],"-1#-2085888500":[{m:"g6-g5",e:5}],"1#-96847685":[{m:"Cg4-h4",e:5}],"-1#1741640381":[{m:"Hh6-g8",e:5}],"1#-100222414":[{m:"Ee3xg5",e:5}],"-1#-1080938894":[{m:"Cg3xc3",e:5}],"1#-1504323393":[{m:"Cf3-g3",e:5}],"-1#-1713398131":[{m:"Ce8xe4",e:5}],"1#1495124068":[{m:"Ke1-e2",e:5}],"-1#-103681429":[{m:"Hg8-f6",e:5}],"1#1537222360":[{m:"Cg3xg10+",e:5}],"-1#-1207209158":[{m:"Ke10-e9",e:5}],"1#1600179891":[{m:"Hb1-c3",e:9.677}],"-1#221816318":[{m:"Hb10-c8",e:9.677}],"1#472430402":[{m:"Ec1-e3",e:9.677},{m:"Ra1-b1",e:9.677},{m:"g4-g5",e:9.677}],"-1#-1362208405":[{m:"Ra10-a9",e:7.5},{m:"Hh10-g8",e:7.5},{m:"Ra10-b10",e:7.5}],"1#-1231568854":[{m:"Ad1-e2",e:5}],"-1#-107032278":[{m:"Ra9-d9",e:5}],"1#-1777415031":[{m:"g4-g5",e:5}],"1#1813422630":[{m:"Ad1-e2",e:5}],"-1#589280038":[{m:"Ch8-i8",e:5}],"1#-1766033422":[{m:"Ad1-e2",e:5}],"-1#-642423054":[{m:"g7-g6",e:5}],"1#-1393585777":[{m:"Ch3-g3",e:5}],"-1#713312190":[{m:"Ra10-a9",e:9.615},{m:"Hh10-g8",e:9.615},{m:"Ch8-f8",e:9.615}],"1#-396575501":[{m:"Rb1-b7",e:9.412},{m:"g4-g5",e:9.412},{m:"Hh1-g3",e:9.412},{m:"Rb1-b5",e:9.412}],"1#-375579241":[{m:"Hh1-i3",e:5}],"-1#-267182679":[{m:"Hh10-g8",e:5}],"1#852223716":[{m:"Ri1-h1",e:5}],"-1#945208788":[{m:"i7-i6",e:5}],"1#935031563":[{m:"Ch3-g3",e:5}],"-1#1357070767":[{m:"Hh10-i8",e:6.667},{m:"Ra10-b10",e:6.667}],"1#-661096877":[{m:"Hh1-g3",e:5}],"-1#-1759126629":[{m:"Hh10-i8",e:5}],"1#-1353190142":[{m:"c4-c5",e:6.667},{m:"Ec1-e3",e:6.667}],"-1#1615120778":[{m:"Ri10-i9",e:5}],"1#569253358":[{m:"Eg1-e3",e:5}],"-1#498146091":[{m:"Rb10-b6",e:5}],"1#1856201405":[{m:"Ad1-e2",e:5}],"1#1754361654":[{m:"Hh1-g3",e:5}],"-1#657244926":[{m:"Hh10-i8",e:5}],"1#1674806050":[{m:"Hb1-c3",e:6.667}],"-1#831252591":[{m:"Cb8-g8",e:5}],"1#1481015019":[{m:"Hb1-c3",e:7.5}],"-1#169743782":[{m:"Hb10-c8",e:7.5}],"1#453904154":[{m:"Ra1-b1",e:7.5},{m:"Hh1-i3",e:7.5}],"-1#765655014":[{m:"c7-c6",e:6.667}],"-1#41944868":[{m:"Hh10-i8",e:5}],"1#-1963249448":[{m:"Ra1-b1",e:5}],"-1#-1135099868":[{m:"i7-i6",e:5}],"1#-1279652101":[{m:"c4-c5",e:5}],"-1#2091463283":[{m:"Ec10-e8",e:5}],"1#1346056848":[{m:"Cf3-f7",e:5}],"-1#-1683399968":[{m:"Hi8-h6",e:5}],"1#1287880414":[{m:"Ch3xh8",e:5}],"-1#2093612445":[{m:"Hh6xf7",e:5}],"1#1285836188":[{m:"Ri1-h1",e:5}],"-1#1178146476":[{m:"g7-g6",e:5}],"1#862183889":[{m:"Ch8-h9",e:5}],"-1#-1229552204":[{m:"Ri10-i7",e:5}],"1#1937375082":[{m:"Ec1-e3",e:5}],"-1#-1046539965":[{m:"Ad10-e9",e:5}],"1#761145778":[{m:"Ch9-h10",e:5}],"-1#1041467667":[{m:"e7-e6",e:5}],"1#-1665008540":[{m:"Rh1-h9",e:5}],"1#-1449802268":[{m:"Hb1-c3",e:6.667}],"-1#-70406487":[{m:"Ra10-a9",e:6.667}],"1#529665638":[{m:"Hb1-c3",e:7.5}],"-1#1305109803":[{m:"Hb10-c8",e:7.5},{m:"Cb8-e8",e:7.5},{m:"Hb10-a8",e:7.5}],"1#2019709571":[{m:"Ra1-b1",e:5}],"-1#1322164863":[{m:"Hb10-c8",e:5}],"1#1608429763":[{m:"Hh1-i3",e:5}],"-1#1179693309":[{m:"Hh10-g8",e:5}],"1#-2071442512":[{m:"Ch3-g3",e:5}],"-1#-1703520362":[{m:"Hg8-f6",e:5}],"1#940016421":[{m:"Ec1-e3",e:5}],"-1#-1964937972":[{m:"Hf6xe4",e:5}],"1#-2018167897":[{m:"Cg3xg6",e:5}],"-1#-455001645":[{m:"Ch8-h3",e:5}],"1#201492154":[{m:"Hc3xe4",e:5}],"-1#101927795":[{m:"Ce8xe4+",e:5}],"1#414396004":[{m:"Ad1-e2",e:5}],"-1#1471823716":[{m:"Ri10-h10",e:5}],"1#123544873":[{m:"Ra1-b1",e:5}],"-1#837932501":[{m:"Ra10-b10",e:5}],"1#159644492":[{m:"Rb1-b5",e:5}],"-1#1361955191":[{m:"Cb8-c8",e:5}],"1#-573340907":[{m:"Rb5-f5",e:5}],"-1#1372098126":[{m:"Hh10-g8",e:5}],"1#-1827638013":[{m:"Hh1-i3",e:5}],"-1#-1969326787":[{m:"Eg10-e8",e:5}],"1#1237535170":[{m:"Eg1-e3",e:5}],"-1#-816165104":[{m:"Rb10-b6",e:5}],"1#-1136118138":[{m:"Ri1-g1",e:5}],"-1#-577413413":[{m:"Ch8-h10",e:5}],"1#-515145405":[{m:"g4-g5",e:5}],"-1#-1061844228":[{m:"g7-g6",e:9.999},{m:"Cb8-d8",e:9.999},{m:"Ch8-f8",e:9.999},{m:"Hb10-a8",e:9.999},{m:"Cb8-c8",e:9.999},{m:"Hh10-i8",e:9.999},{m:"Cb8-f8",e:9.999},{m:"Hh10-g8",e:9.999},{m:"Ec10-a8",e:9.999},{m:"Ch8-e8",e:9.999},{m:"Ch8-c8",e:9.999},{m:"c7-c6",e:9.999},{m:"Ec10-e8",e:9.999},{m:"Cb8-e8",e:9.999},{m:"Ch8-d8",e:9.999},{m:"Hb10-c8",e:9.999},{m:"Cb8-g8",e:9.999},{m:"Ad10-e9",e:9.999},{m:"Eg10-e8",e:9.999}],"1#-1242595967":[{m:"Eg1-e3",e:9.996},{m:"Ch3-g3",e:9.996},{m:"Cb3-e3",e:9.996},{m:"Ch3-e3",e:9.996},{m:"c4-c5",e:9.545},{m:"Cb3-g3",e:9.996},{m:"g4-g5",e:9.996},{m:"c4-c5",e:9.961},{m:"c4-c5",e:8.333},{m:"c4-c5",e:9.924},{m:"c4-c5",e:9.982},{m:"Cb3-f3",e:9.996},{m:"Hh1-i3",e:9.996}],"-1#863402835":[{m:"g7-g6",e:9.412}],"-1#-1424924249":[{m:"Ch8-g8",e:9.993},{m:"Hb10-c8",e:9.993}],"-1#531622427":[{m:"Eg10-e8",e:9.957},{m:"Ch8-e8",e:9.957}],"-1#-277285787":[{m:"Ch8-e8",e:9.853}],"-1#118068136":[{m:"Ch8-e8",e:8},{m:"Hh10-g8",e:8}],"1#1684071059":[{m:"Hb1-c3",e:5}],"-1#909674974":[{m:"Hb10-a8",e:5}],"1#-976131867":[{m:"c4-c5",e:7.5}],"-1#-220838995":[{m:"Ec10-e8",e:7.5}],"-1#-115045524":[{m:"g6xg5",e:5}],"-1#917334105":[{m:"Ch8-f8",e:9.231},{m:"Ch8-c8",e:9.231},{m:"g7-g6",e:8},{m:"Cb8-c8",e:9.231}],"1#-172739984":[{m:"Hh1-g3",e:5}],"1#-835907869":[{m:"Hb1-c3",e:5}],"-1#-1891683718":[{m:"Ra10-a9",e:9.6},{m:"Hh10-g8",e:9.6},{m:"g7-g6",e:8.889},{m:"Ch8-e8",e:9.6},{m:"Ec10-e8",e:9.6}],"1#-1754879173":[{m:"Hb1-c3",e:8.571},{m:"Ch3-e3",e:8.571}],"-1#-839834913":[{m:"Hb10-c8",e:5}],"1#1307035959":[{m:"Hb1-c3",e:9.375}],"-1#532652666":[{m:"Cb8-f8",e:9.375}],"1#-1641078586":[{m:"c4-c5",e:6.667}],"-1#-864597109":[{m:"g7-g6",e:8.75},{m:"Hh10-g8",e:8.571}],"1#-200973038":[{m:"Ra1-b1",e:8.333}],"-1#-1029073426":[{m:"Ch8-e8",e:8.571},{m:"Hh10-g8",e:8.571}],"1#-1581194027":[{m:"Hh1-g3",e:5}],"1#7433891":[{m:"Ch3-e3",e:9.286}],"1#246395078":[{m:"Ra1-b1",e:8.889}],"1#-329891007":[{m:"Ch3-e3",e:5}],"-1#-1228813659":[{m:"Hh10-g8",e:5}],"1#1947808232":[{m:"Hh1-g3",e:5}],"1#-1548930407":[{m:"Cb3-d3",e:9.444},{m:"Hb1-c3",e:9.929}],"-1#-235578924":[{m:"Hb10-a8",e:9.929}],"-1#-407431476":[{m:"Hh10-g8",e:9.991},{m:"Cb8-c8",e:9.991},{m:"Eg10-e8",e:9.991}],"-1#-95236023":[{m:"Ch8-f8",e:9.971},{m:"Cb8-b4",e:9.971}],"-1#-796839186":[{m:"g7-g6",e:9.091}],"-1#-1402896961":[{m:"Ch8-e8",e:7.5},{m:"g7-g6",e:8.333}],"1#-1376772593":[{m:"Eg1-e3",e:8},{m:"Hb1-c3",e:8}],"-1#728307933":[{m:"Hb10-a8",e:9.964},{m:"g7-g6",e:9.964},{m:"Ch8-e8",e:9.964},{m:"Hb10-c8",e:9.964},{m:"Hh10-g8",e:9.964}],"1#1644058847":[{m:"Hb1-c3",e:9.963}],"1#1580461984":[{m:"Hb1-c3",e:7.5}],"1#1207986662":[{m:"Hb1-c3",e:5}],"1#981011041":[{m:"Hb1-c3",e:8.571}],"1#-374217840":[{m:"g4-g5",e:5}],"-1#-5737150":[{m:"Hb10-a8",e:7.5},{m:"Hh10-g8",e:7.5}],"1#-1254148800":[{m:"Ra1-b1",e:7.5}],"-1#-2087467588":[{m:"Ra10-b10",e:7.5}],"1#-1142822107":[{m:"Cb3-b7",e:7.5}],"-1#-1486003233":[{m:"Hh10-g8",e:7.5}],"1#1030786575":[{m:"Ad1-e2",e:7.5},{m:"Ra1-b1",e:7.5}],"-1#1920573199":[{m:"Hb10-a8",e:5}],"-1#198999795":[{m:"Hb10-c8",e:6.667},{m:"Hb10-a8",e:6.667}],"1#61657301":[{m:"Ch3-e3",e:8.333},{m:"g4-g5",e:8.333},{m:"Cb3-e3",e:8.333},{m:"c4-c5",e:6.667}],"-1#1497061681":[{m:"Hb10-c8",e:5}],"1#1210796941":[{m:"Hb1-c3",e:9.889},{m:"g4-g5",e:9.889},{m:"Cb3-b7",e:9.889},{m:"Cb3-c3",e:9.889},{m:"Cb3-d3",e:9.889},{m:"Ri1-i2",e:9.889}],"-1#1332160056":[{m:"Hh10-i8",e:5}],"1#-954461756":[{m:"Hh1-g3",e:5}],"-1#-2002666484":[{m:"Ri10-h10",e:5}],"1#-757022211":[{m:"Ri1-h1",e:5}],"-1#-662857011":[{m:"Rh10-h6",e:5}],"1#2108302231":[{m:"Ch3-i3",e:5}],"-1#-1444133041":[{m:"Hb10-c8",e:5}],"1#-1191422477":[{m:"Hb1-c3",e:5}],"-1#-358334786":[{m:"Hh10-g8",e:5}],"1#679265779":[{m:"Ch3-g3",e:5}],"-1#914545109":[{m:"Ri10-h10",e:5}],"1#1824760868":[{m:"Hh1-i3",e:5}],"-1#1374993304":[{m:"Hh10-g8",e:7.5},{m:"Hb10-c8",e:7.5}],"1#-1825816363":[{m:"Ch3-e3",e:5}],"-1#-910440143":[{m:"Hb10-c8",e:5}],"1#-659825779":[{m:"Hc3-d5",e:9.811},{m:"Cb3-a3",e:9.811}],"-1#-219667024":[{m:"Ad10-e9",e:9.767}],"-1#-348794143":[{m:"Ri10-h10",e:9.091}],"1#1088727332":[{m:"Hh1-i3",e:6.667},{m:"Hh1-g3",e:6.667}],"-1#1500162330":[{m:"Hh10-g8",e:5}],"1#-1682812329":[{m:"Ri1-h1",e:5}],"-1#257492204":[{m:"g7-g6",e:5}],"1#2047079313":[{m:"Ch3-h7",e:5}],"1#-1977431298":[{m:"Ch3-e3",e:9.744},{m:"Hb1-c3",e:9.744},{m:"Cb3-e3",e:9.744}],"-1#-793427174":[{m:"Ch8-e8",e:8.889},{m:"Hb10-a8",e:9.975},{m:"Ec10-e8",e:8.889}],"1#-1277414879":[{m:"Hh1-g3",e:8}],"1#309180503":[{m:"Hh1-g3",e:8}],"1#-64535559":[{m:"Hh1-g3",e:5}],"-1#-663051853":[{m:"Eg10-e8",e:9.643},{m:"Ch8-e8",e:9.643},{m:"Hh10-g8",e:9.643},{m:"Cb8-e8",e:9.643},{m:"Hb10-a8",e:7.5},{m:"g7-g6",e:9.643},{m:"Ra10-a9",e:9.643}],"-1#543317348":[{m:"Eg10-e8",e:7.5},{m:"Hh10-g8",e:7.5}],"1#-482385509":[{m:"Hb1-c3",e:5}],"-1#-1318647082":[{m:"Ra10-a9",e:5}],"1#-1455516777":[{m:"Ra1-b1",e:5}],"1#-491084247":[{m:"Hb1-c3",e:6.667}],"-1#-1327313564":[{m:"Ra10-b10",e:6.667}],"1#1280032926":[{m:"Hb1-a3",e:9.998},{m:"Hb1-c3",e:9.998},{m:"Ra1-a2",e:9.998},{m:"c4-c5",e:9.167},{m:"Hh1-g3",e:9.998},{m:"Ad1-e2",e:9.998},{m:"Ch3-h5",e:9.998},{m:"Ec1-e3",e:9.998},{m:"Ch3-e3",e:9.998},{m:"Cb3-e3",e:9.998}],"-1#1402305734":[{m:"Hh10-g8",e:9.859}],"-1#504605651":[{m:"c7-c6",e:8.75},{m:"Hb10-a8",e:8.75}],"-1#-989181899":[{m:"Ch8-e8",e:9.091}],"-1#-892156340":[{m:"g7-g6",e:9.932},{m:"Eg10-e8",e:9.932},{m:"Ch8-e8",e:9.932},{m:"Hb10-a8",e:9.932},{m:"Hh10-g8",e:9.932}],"1#-2142927282":[{m:"Hb1-a3",e:9.921}],"-1#66481494":[{m:"Hh10-g8",e:9.891}],"-1#54710686":[{m:"Hb10-a8",e:9.778},{m:"Ec10-e8",e:9.778}],"-1#1007980189":[{m:"Hh10-g8",e:9.444}],"-1#-22204745":[{m:"Ch8-e8",e:9.895}],"-1#383535482":[{m:"Cb8-c8",e:9.286}],"-1#-435464444":[{m:"Ch8-e8",e:9.96},{m:"c7-c6",e:9.96}],"1#1221508352":[{m:"Cb3-e3",e:5}],"-1#-493999462":[{m:"Cb8-e8",e:5}],"1#-685368014":[{m:"Hh1-g3",e:5}],"-1#-1734627078":[{m:"Hb10-c8",e:5}],"1#-1987337658":[{m:"Hb1-c3",e:5}],"-1#-606877429":[{m:"Ra10-b10",e:5}],"1#-475928686":[{m:"g4-g5",e:5}],"-1#-1352003201":[{m:"Rb10-b6",e:5}],"1#-596088599":[{m:"Ra1-b1",e:5}],"-1#-355166187":[{m:"Rb6xb1",e:5}],"1#1211608355":[{m:"Hc3xb1",e:5}],"-1#-772999540":[{m:"Ch8-g8",e:5}],"1#-1491609530":[{m:"Ri1-h1",e:5}],"-1#-1383431306":[{m:"g7-g6",e:5}],"1#-657427445":[{m:"Hg3-f5",e:5}],"-1#-1910364308":[{m:"g6xg5",e:5}],"1#350678875":[{m:"Hf5-d6",e:5}],"-1#-91309835":[{m:"Ri10-i9",e:5}],"1#-1155240815":[{m:"Hb1-c3",e:5}],"-1#-377747492":[{m:"Ri9-f9",e:5}],"1#-46410178":[{m:"Ch3-h8",e:5}],"-1#-185659421":[{m:"Rf9-h9",e:5}],"1#-474172433":[{m:"Ch8-h7",e:5}],"1#-231011060":[{m:"Hb1-c3",e:9.545},{m:"Ra1-a2",e:9.545}],"-1#-1604098495":[{m:"Hb10-c8",e:9.545}],"1#-1317833475":[{m:"c4-c5",e:6.667},{m:"Hh1-g3",e:9.545}],"-1#-2015394815":[{m:"Ra10-b10",e:9.545},{m:"Ra10-a9",e:9.545},{m:"Eg10-e8",e:9.545},{m:"Ec10-e8",e:9.545},{m:"Ad10-e9",e:9.545},{m:"Hh10-g8",e:9.545},{m:"Hh10-i8",e:9.545},{m:"g7-g6",e:9.545}],"1#-1618600640":[{m:"Ch3-e3",e:5}],"1#1149417726":[{m:"g4-g5",e:5}],"1#-1420983070":[{m:"Hh1-i3",e:7.5}],"1#1797176560":[{m:"Hh1-g3",e:5}],"1#1158119244":[{m:"g4-g5",e:7.5}],"1#262452221":[{m:"Hh1-i3",e:8.333}],"1#-226135172":[{m:"Cb3-a3",e:8.571}],"-1#-19998411":[{m:"g7-g6",e:6.667},{m:"Hh10-g8",e:6.667}],"1#-1953223096":[{m:"Hc3-b5",e:7.5},{m:"Ra1-a2",e:7.5}],"-1#-1028210652":[{m:"Hh10-g8",e:6.667}],"1#7224169":[{m:"Ra1-a2",e:6.667}],"-1#47556323":[{m:"Ec10-e8",e:5}],"1#1008083576":[{m:"Hc3-d5",e:5}],"-1#374725701":[{m:"g7-g6",e:5}],"1#1661938488":[{m:"Ch3-h7",e:8},{m:"Cb3-e3",e:8}],"-1#389920130":[{m:"Ra10-b10",e:5}],"-1#-917521246":[{m:"Af10-e9",e:7.5}],"-1#2071627175":[{m:"Hb10-c8",e:5}],"1#1785370395":[{m:"Ra2-f2",e:5}],"-1#-666362313":[{m:"Ad10-e9",e:5}],"1#881403590":[{m:"Cb3-e3",e:5}],"-1#-1630949028":[{m:"Ec10-e8",e:5}],"1#-1302613569":[{m:"Hh1-g3",e:5}],"-1#-35251081":[{m:"g7-g6",e:5}],"1#-2000884982":[{m:"Rf2-f7",e:5}],"-1#1695411425":[{m:"Hh10-i8",e:5}],"1#-310977763":[{m:"i4-i5",e:5}],"-1#1399440253":[{m:"Ch8-g8",e:5}],"1#630386103":[{m:"e4-e5",e:5}],"-1#-1575155461":[{m:"Ri10-h10",e:5}],"1#-128158454":[{m:"Ch3-h7",e:5}],"-1#-1938887760":[{m:"Ra10-d10",e:5}],"1#1245768410":[{m:"Hg3-e4",e:5}],"-1#-1455595579":[{m:"Rd10-d4",e:5}],"1#40726961":[{m:"Hh1-g3",e:9.99},{m:"Ch3-g3",e:9.99},{m:"c4-c5",e:9.946},{m:"c4-c5",e:9.999},{m:"c4-c5",e:9.767},{m:"c4-c5",e:9.885},{m:"c4-c5",e:9.988},{m:"c4-c5",e:8.333},{m:"Cb3-d3",e:9.99},{m:"Hh1-i3",e:9.99}],"-1#1305533561":[{m:"g7-g6",e:8}],"1#948579076":[{m:"Cb3-d3",e:9.97},{m:"Hb1-c3",e:9.97}],"-1#479423895":[{m:"Ri10-h10",e:9},{m:"Eg10-e8",e:9},{m:"Cb8-e8",e:9}],"-1#-1473386965":[{m:"Ec10-e8",e:9.744},{m:"Hb10-c8",e:9.744},{m:"g7-g6",e:9.744},{m:"Cb8-d8",e:9.744},{m:"Ra10-a9",e:9.744},{m:"Ch8-i8",e:9.744}],"1#-2067798328":[{m:"Cb3-e3",e:9.474},{m:"Hb1-c3",e:9.906}],"-1#-1657673994":[{m:"Ri10-i9",e:9.412}],"1#-1187122025":[{m:"Hb1-c3",e:9}],"-1#-345661478":[{m:"Hh10-g8",e:9.873}],"1#-579399338":[{m:"Hb1-c3",e:9.928},{m:"Hh1-i3",e:9.928}],"1#-983010600":[{m:"Hb1-c3",e:7.5}],"-1#-1758455403":[{m:"Hb10-c8",e:9.333}],"1#-1334542486":[{m:"Hb1-c3",e:7.5}],"-1#-500427737":[{m:"Ra9-f9",e:7.5}],"1#-1781758760":[{m:"Hh1-g3",e:9}],"-1#1492842581":[{m:"Hb10-a8",e:9.975},{m:"Cb8-e8",e:9.975},{m:"Cb8-c8",e:9.975},{m:"Cb8-d8",e:9.975},{m:"g7-g6",e:9.975}],"-1#-1333026920":[{m:"Cb8-e8",e:8.75},{m:"Hh10-g8",e:8}],"1#-2061260752":[{m:"Hh1-g3",e:5}],"-1#-895613448":[{m:"Hb10-c8",e:5}],"-1#1345657596":[{m:"Ec10-e8",e:9.979},{m:"Hb10-c8",e:9.979},{m:"Hh10-g8",e:9.643},{m:"Cb8-c8",e:9.979}],"-1#-2127600535":[{m:"Hb10-a8",e:8},{m:"Ri10-h10",e:8},{m:"g7-g6",e:8}],"1#-877124501":[{m:"Hh1-g3",e:5}],"1#-613541480":[{m:"Hh1-g3",e:6.667},{m:"Cb3-c3",e:6.667}],"-1#1319536476":[{m:"Cb8-c8",e:9.979},{m:"Ri10-i9",e:9.979},{m:"Ch8-h9",e:9.979},{m:"Ec10-e8",e:9.979},{m:"Ch8-i8",e:9.979},{m:"Cb8-e8",e:9.979},{m:"Hb10-a8",e:9.979}],"1#-1034367682":[{m:"Eg1-e3",e:9.94}],"-1#951926346":[{m:"Ch8-i8",e:9.091},{m:"Hh10-g8",e:9.6},{m:"Hb10-a8",e:9.091}],"-1#467890575":[{m:"g7-g6",e:8.333},{m:"Cb8-e8",e:8.333}],"1#776685095":[{m:"Hb1-c3",e:5}],"1#1807642813":[{m:"Ch3-e3",e:5}],"-1#824834393":[{m:"Hh10-g8",e:5}],"1#-202309100":[{m:"Hh1-g3",e:5}],"-1#-1135824932":[{m:"Ri10-h10",e:5}],"1#-435301843":[{m:"Ri1-h1",e:5}],"-1#-326072035":[{m:"Ch8-h6",e:5}],"1#-681971169":[{m:"Hb1-c3",e:5}],"-1#-2063492782":[{m:"Ad10-e9",e:5}],"1#1774231971":[{m:"Hc3-d5",e:5}],"-1#1132683166":[{m:"Hb10-c8",e:5}],"1#1385385250":[{m:"Cb3-c3",e:5}],"-1#1484484155":[{m:"Ra10-b10",e:5}],"1#1611219106":[{m:"Ra1-b1",e:5}],"-1#1453699166":[{m:"g7-g6",e:5}],"1#603932451":[{m:"Rb1-b7",e:5}],"-1#53210240":[{m:"Ch6-h7",e:5}],"1#1653370628":[{m:"Rh1-h5",e:5}],"-1#-230170196":[{m:"c7-c6",e:5}],"1#824187543":[{m:"Hd5-c7",e:5}],"-1#795159281":[{m:"c6xc5",e:5}],"1#337509221":[{m:"Rh5xc5",e:5}],"-1#1207399161":[{m:"Hg8-f6",e:5}],"1#-1545798713":[{m:"Hh1-g3",e:9.964},{m:"Hb1-c3",e:9.964},{m:"Cb3-e3",e:9.964},{m:"c4-c5",e:9.997}],"-1#-329165297":[{m:"g7-g6",e:9.959},{m:"Hh10-g8",e:9.959},{m:"Ri10-i9",e:9.959},{m:"Cb8-c8",e:9.959}],"1#-1724145294":[{m:"Hb1-c3",e:5}],"1#783920450":[{m:"c4-c5",e:6.667}],"-1#606402162":[{m:"Hb10-a8",e:9.955},{m:"g7-g6",e:9.955},{m:"Cb8-d8",e:9.955},{m:"Cb8-c8",e:9.955},{m:"Ri10-h10",e:9.955},{m:"Ri10-i9",e:9.955}],"1#1857271408":[{m:"Hb1-c3",e:8.75}],"1#1367212303":[{m:"c4-c5",e:6.667}],"-1#650497552":[{m:"Cb8-b4",e:8.75},{m:"Hb10-a8",e:8.75},{m:"Ri10-i9",e:8.75},{m:"Hb10-c8",e:8.75}],"1#-1693939948":[{m:"Hb1-c3",e:6.667}],"-1#-917443495":[{m:"Cb4-c4",e:6.667},{m:"Hb10-a8",e:6.667}],"1#-1469534960":[{m:"Rh1-h5",e:5}],"-1#950215608":[{m:"Hb10-c8",e:5}],"1#699609348":[{m:"g4-g5",e:5}],"-1#1702414313":[{m:"Ra10-b10",e:5}],"1#1560996208":[{m:"Ra1-b1",e:5}],"-1#1806047628":[{m:"Rb10-b6",e:5}],"1#-2084066213":[{m:"Ec1-e3",e:7.5},{m:"Eg1-e3",e:7.5}],"-1#824263282":[{m:"Ra10-a9",e:5}],"-1#90090121":[{m:"Ri10-i9",e:6.667}],"1#1817349650":[{m:"Hb1-c3",e:6.667}],"-1#1040901471":[{m:"Cb8-d8",e:8.571},{m:"Hb10-a8",e:6.667},{m:"Ra10-a9",e:8.571}],"1#1397715372":[{m:"Ra1-b1",e:5}],"-1#1709408592":[{m:"Ra10-b10",e:5}],"1#1569828809":[{m:"Cb3-b7",e:5}],"-1#1092429619":[{m:"Ad10-e9",e:5}],"1#643005470":[{m:"a4-a5",e:7.5},{m:"Ec1-e3",e:7.5}],"-1#138271058":[{m:"Ra9-f9",e:5}],"1#-819211812":[{m:"a5-a6",e:5}],"-1#-1800039881":[{m:"Ra9-d9",e:6.667}],"1#1735334516":[{m:"Hb1-c3",e:5}],"-1#892825913":[{m:"Ri9-d9",e:6.667},{m:"Cb8-c8",e:6.667}],"1#-902571898":[{m:"Rh1-h5",e:6.667}],"-1#1526224430":[{m:"Hb10-c8",e:6.667},{m:"Hb10-a8",e:6.667}],"1#275715628":[{m:"g4-g5",e:5}],"1#-1177994405":[{m:"Rh1-h5",e:5}],"-1#688043507":[{m:"Ri9-b9",e:5}],"1#1751222332":[{m:"Hc3-d5",e:5}],"-1#1109554689":[{m:"Ce8-e9",e:5}],"1#-1378323844":[{m:"Cb3-d3",e:5}],"1#936762540":[{m:"Hb1-c3",e:6.667}],"-1#1703786465":[{m:"Hg8-f6",e:6.667},{m:"Ra10-a9",e:6.667}],"1#-939760814":[{m:"Ra1-a2",e:5}],"-1#1321069561":[{m:"Ce8-f8",e:5}],"1#-216991846":[{m:"Ra2-d2",e:5}],"-1#655635872":[{m:"Ec10-e8",e:5}],"1#193344835":[{m:"Rh1-h7",e:5}],"1#2111057568":[{m:"Cb3-b5",e:5}],"-1#1251835422":[{m:"Ra9-f9",e:5}],"1#-1920239984":[{m:"Ec1-e3",e:5}],"-1#1064147129":[{m:"e7-e6",e:5}],"1#-1648366130":[{m:"Rh1-h7",e:5}],"1#1231118977":[{m:"Hb1-c3",e:7.5}],"1#-1462060016":[{m:"Hb1-c3",e:8}],"1#2120584067":[{m:"Hb1-c3",e:9.94},{m:"Eg1-e3",e:9.94}],"1#1703813654":[{m:"g4-g5",e:9.545}],"1#-1379171733":[{m:"Ri1-h1",e:5}],"-1#-242970486":[{m:"Hh10-g8",e:9.688}],"1#861694919":[{m:"g4-g5",e:9.688},{m:"Eg1-e3",e:9.688},{m:"Hh1-i3",e:9.688},{m:"Ra1-a2",e:9.688},{m:"Ch3-f3",e:9.688}],"-1#-1245352683":[{m:"g7-g6",e:8}],"-1#161246301":[{m:"Hh10-g8",e:5}],"1#-884697328":[{m:"Hb1-c3",e:5}],"-1#-1726153635":[{m:"Ri10-h10",e:5}],"1#-1017282132":[{m:"Hh1-g3",e:5}],"-1#-1931465628":[{m:"Cb8-d8",e:5}],"1#-509233001":[{m:"Hc3-d5",e:5}],"-1#-112496093":[{m:"Hh10-g8",e:8.75},{m:"Cb8-c8",e:8.75}],"1#999524718":[{m:"Hb1-c3",e:8.571},{m:"Hh1-g3",e:8.571}],"1#1974810689":[{m:"Hb1-a3",e:9.979},{m:"Ad1-e2",e:9.979}],"1#943057990":[{m:"Hb1-c3",e:9.868},{m:"Hb1-a3",e:9.868},{m:"Cb3-e3",e:9.868},{m:"Hh1-g3",e:9.868},{m:"Eg1-e3",e:9.868},{m:"Ch3-e3",e:9.868},{m:"Ec1-e3",e:9.868}],"-1#1785562891":[{m:"Hh10-g8",e:6.667}],"1#-1464501178":[{m:"Cb3-a3",e:6.667}],"-1#669732894":[{m:"Hh10-g8",e:6.667}],"1#-449598637":[{m:"Hh1-g3",e:6.667}],"-1#-1837794340":[{m:"Hh10-g8",e:8}],"1#1353547921":[{m:"Hb1-c3",e:8}],"-1#2005418382":[{m:"Hh10-g8",e:5}],"1#-1253000509":[{m:"Ri1-h1",e:5}],"-1#-1095964012":[{m:"Hh10-g8",e:8.333}],"1#2087981529":[{m:"Hb1-c3",e:8.333},{m:"g4-g5",e:8.333}],"-1#1654810018":[{m:"Hh10-g8",e:5}],"1#-1602576657":[{m:"Hb1-c3",e:5}],"-1#-1965882769":[{m:"Ec10-e8",e:9.836},{m:"Hh10-g8",e:9.836}],"1#64123335":[{m:"c5xc6",e:9.091}],"-1#1010895379":[{m:"Ec10-e8",e:9.091}],"1#282266352":[{m:"Ch3-e3",e:9.091},{m:"Ec1-e3",e:9.091},{m:"Hh1-i3",e:9.091},{m:"c6-c7",e:9.091},{m:"Hb1-c3",e:9.091}],"-1#1246003988":[{m:"Hb10-d9",e:6.667}],"1#1080491022":[{m:"Cb3-c3",e:6.667},{m:"Cb3-d3",e:6.667}],"-1#-1573526311":[{m:"Hb10-d9",e:6.667}],"1#-1474847805":[{m:"Hb1-c3",e:6.667},{m:"Hb1-d2",e:6.667}],"-1#-95424370":[{m:"Ra10-c10",e:6.667}],"-1#157092558":[{m:"Hb10-d9",e:5}],"1#58684884":[{m:"Ri1-i2",e:5}],"-1#1446721980":[{m:"Ra10-c10",e:5}],"1#63449425":[{m:"c6-d6",e:5}],"-1#2125583428":[{m:"Hb10-d9",e:8}],"1#1955834718":[{m:"c7-d7",e:8}],"-1#850585335":[{m:"Ra10-c10",e:8}],"-1#1116430781":[{m:"Hb10-d9",e:5}],"1#1219042983":[{m:"Hb1-c3",e:6.667}],"1#-332953057":[{m:"Hb1-c3",e:9.99},{m:"g4-g5",e:9.99},{m:"Cb3-f3",e:9.99},{m:"Eg1-e3",e:9.99},{m:"Cb3-e3",e:9.99},{m:"c4-c5",e:8.75},{m:"c4-c5",e:9.697},{m:"Cb3-d3",e:9.99},{m:"Hh1-g3",e:9.99},{m:"Ch3-d3",e:9.99},{m:"c4-c5",e:5}],"-1#-1098915502":[{m:"Hh10-i8",e:9.979
},{m:"Hb10-c8",e:9.979}],"-1#-1595114254":[{m:"Hh10-i8",e:8.333},{m:"Ch8-g8",e:8.333}],"-1#-1991654032":[{m:"g7-g6",e:8.333},{m:"Hh10-i8",e:8.333}],"-1#1790872781":[{m:"g7-g6",e:9.697},{m:"Hb10-d9",e:9.697}],"-1#1181162885":[{m:"g7-g6",e:9.94}],"-1#1589732406":[{m:"g7-g6",e:8.75},{m:"Hh10-i8",e:8.75}],"1#731616075":[{m:"Hb1-c3",e:8.571}],"1#-692431926":[{m:"i4-i5",e:5}],"-1#-1229978629":[{m:"Ri10-i9",e:9.891},{m:"g7-g6",e:9.891},{m:"Hh10-g8",e:9.891},{m:"Cb8-c8",e:9.891},{m:"Hb10-d9",e:9.891}],"1#-149235809":[{m:"Hh1-g3",e:8.571}],"-1#-1196983721":[{m:"c7-c6",e:8.571}],"1#-1008012154":[{m:"Cb3-d3",e:9.444},{m:"Hh1-g3",e:9.444}],"-1#-1940432562":[{m:"Hh10-g8",e:9.412}],"1#1953036470":[{m:"Hh1-g3",e:9.851},{m:"Hb1-c3",e:9.851}],"-1#640717819":[{m:"Ri10-i9",e:8}],"1#978209177":[{m:"Ad1-e2",e:9.996},{m:"Ec1-a3",e:9.996},{m:"Hh1-g3",e:9.996}],"1#-1131250463":[{m:"Hh1-g3",e:6.667}],"-1#-214970071":[{m:"Ra10-c10",e:6.667}],"-1#-688405020":[{m:"Hh10-i8",e:9.944},{m:"Hb10-c8",e:9.944}],"-1#-1550178345":[{m:"g7-g6",e:8}],"-1#1868931015":[{m:"g7-g6",e:8},{m:"Hb10-c8",e:8}],"-1#-173438431":[{m:"i7-i6",e:9.778},{m:"Hh10-i8",e:9.778},{m:"Cb8-c8",e:9.778},{m:"g7-g6",e:9.778},{m:"Hh10-g8",e:9.778}],"1#-96189186":[{m:"Ec1-e3",e:9},{m:"Ch3-f3",e:9},{m:"Ch3-g3",e:9},{m:"Cb3-e3",e:9}],"-1#1218620119":[{m:"Hh10-i8",e:5}],"1#-1059480277":[{m:"Ri1-i2",e:5}],"-1#-552070585":[{m:"Hh10-i8",e:5}],"1#1466115515":[{m:"Ri1-h1",e:5}],"-1#-457549608":[{m:"Hh10-i8",e:7.5}],"1#1824616228":[{m:"Ri1-h1",e:7.5}],"-1#1342493540":[{m:"Hb10-d9",e:8},{m:"Hh10-i8",e:8}],"1#2110963165":[{m:"Cb3-e3",e:6.667}],"-1#-678286777":[{m:"Ri10-i9",e:6.667},{m:"Hb10-d9",e:6.667}],"1#-1774649821":[{m:"Hb1-c3",e:5}],"-1#-1000303250":[{m:"Ri9-d9",e:5}],"1#996424913":[{m:"i4-i5",e:5}],"-1#-2055527247":[{m:"Rd9-d4",e:5}],"1#-575646371":[{m:"Ri1-i2",e:5}],"-1#-1997268683":[{m:"Ad10-e9",e:5}],"1#1681203652":[{m:"Hb1-c3",e:5}],"-1#913132169":[{m:"Cb8-b10",e:5}],"1#2035793987":[{m:"Ec1-e3",e:5}],"-1#-877580694":[{m:"Hh10-g8",e:5}],"1#157930791":[{m:"Hb1-c3",e:5}],"-1#1529986666":[{m:"Ch8-i8",e:5}],"1#1724963993":[{m:"Ri1-h1",e:5}],"-1#1817020329":[{m:"Ri10-h10",e:5}],"1#906820184":[{m:"Ra1-b1",e:5}],"-1#10488484":[{m:"Rh10-h6",e:5}],"1#-1518881794":[{m:"Ch3-g3",e:5}],"-1#-1148604456":[{m:"Rh6-b6",e:5}],"1#1186928317":[{m:"Rh1-h5",e:5}],"-1#-697001963":[{m:"Hb10-a8",e:5}],"1#-2131526308":[{m:"Ch3-g3",e:9.333}],"-1#-1643290246":[{m:"Hh10-g8",e:9.951},{m:"Ch8-h4",e:9.951},{m:"i7-i6",e:9.951},{m:"Hb10-d9",e:9.951},{m:"Cb8-c8",e:9.951},{m:"Ri10-i9",e:9.951},{m:"Hh10-i8",e:9.951}],"1#1557502519":[{m:"Ri1-h1",e:9.941}],"1#-1148954096":[{m:"Cb3-e3",e:9.412}],"1#-542657250":[{m:"Ri1-h1",e:5}],"1#930181484":[{m:"Ch3-f3",e:9.474},{m:"Ch3-g3",e:9.474},{m:"Hb1-c3",e:9.474},{m:"Cb3-e3",e:9.474}],"-1#304949205":[{m:"Ri10-i9",e:5}],"1#1401418673":[{m:"Ri1-h1",e:5}],"-1#697265482":[{m:"Ch8-h6",e:9.286},{m:"Ri10-h10",e:9.286}],"-1#1697192481":[{m:"Ri10-i9",e:8.571},{m:"g7-g6",e:8.571}],"1#-182600364":[{m:"Hb1-c3",e:9.796},{m:"Ch3-e3",e:9.796},{m:"Hh1-g3",e:9.796}],"-1#-1488595431":[{m:"Ra10-a9",e:9.792},{m:"Hb10-c8",e:9.792},{m:"Hh10-g8",e:9.792}],"1#-1088663720":[{m:"Ra1-b1",e:6.667},{m:"Hh1-g3",e:6.667}],"1#-1235893083":[{m:"c4-c5",e:8.75},{m:"Hb1-c3",e:8}],"-1#-2131151783":[{m:"Hh10-i8",e:9.783},{m:"Ra10-a9",e:9.783},{m:"Ra10-b10",e:9.783}],"-1#-102209171":[{m:"Hh10-g8",e:8}],"1#1704799572":[{m:"g4-g5",e:5}],"-1#693558201":[{m:"Hb10-c8",e:9.565}],"-1#-1349897040":[{m:"Hb10-c8",e:6.667}],"1#-1097193972":[{m:"Hb1-c3",e:6.667}],"-1#-322810559":[{m:"Ra10-b10",e:6.667}],"1#-726637608":[{m:"Ra1-b1",e:6.667},{m:"Hh1-g3",e:6.667}],"-1#-501443804":[{m:"Rb10-b4",e:5}],"1#523987653":[{m:"Cb3-a3",e:5}],"-1#-1693594096":[{m:"Hh10-i8",e:5}],"1#326564332":[{m:"Ra1-b1",e:6.667}],"-1#-1163915108":[{m:"Hb10-c8",e:8}],"1#-1414528480":[{m:"Cb3-d3",e:8},{m:"Ec1-e3",e:8},{m:"Hb1-c3",e:8}],"-1#-1855959589":[{m:"Ra10-a9",e:6.667},{m:"Ra10-b10",e:6.667}],"-1#425126921":[{m:"Ra10-b10",e:5}],"1#-683269327":[{m:"Eg1-e3",e:9.945},{m:"Ri1-i2",e:9.945},{m:"c4-c5",e:9.091},{m:"Cb3-d3",e:9.945},{m:"Hh1-g3",e:9.945},{m:"Ch3-e3",e:9.945},{m:"c4-c5",e:8.333},{m:"Hh1-i3",e:9.945}],"-1#1373578723":[{m:"Hh10-g8",e:9.959},{m:"Ch8-d8",e:5}],"1#457729505":[{m:"Hb1-c3",e:6.667},{m:"Ri1-i2",e:6.667}],"-1#1225789100":[{m:"Hh10-g8",e:6.667}],"-1#-2113769639":[{m:"Hh10-g8",e:8}],"1#1088066580":[{m:"Ri2-d2",e:8}],"-1#-285787913":[{m:"Ad10-e9",e:8}],"-1#1705037080":[{m:"Hh10-g8",e:8.75}],"1#-1485293995":[{m:"Hb1-c3",e:8.75},{m:"Hh1-i3",e:8.75},{m:"Ch3-f3",e:8.75},{m:"Hh1-g3",e:8.75}],"-1#-308908854":[{m:"Hb10-a8",e:5}],"1#-1493095224":[{m:"Hb1-c3",e:5}],"-1#-178698363":[{m:"Hh10-g8",e:5}],"-1#-1728344327":[{m:"Hh10-g8",e:9.929},{m:"Ri10-i9",e:9.929}],"-1#-1915639083":[{m:"Hh10-g8",e:9.231}],"1#1326010776":[{m:"Hh1-g3",e:9.231}],"-1#11861072":[{m:"Ri10-h10",e:9.231}],"-1#-2061612932":[{m:"Hh10-g8",e:9.167}],"1#1204204337":[{m:"Hh1-g3",e:9.167},{m:"Hh1-i3",e:9.167},{m:"Eg1-e3",e:9.167},{m:"Ch3-e3",e:9.167}],"-1#1581822735":[{m:"Hb10-a8",e:6.667}],"-1#-1050692125":[{m:"Ec10-e8",e:9.89}],"-1#491862741":[{m:"Ri10-h10",e:6.667}],"-1#-825744625":[{m:"Hh10-g8",e:8.75}],"1#202430530":[{m:"Ri1-h1",e:8.75}],"1#-777676736":[{m:"c4-c5",e:7.5},{m:"c4-c5",e:9.986}],"-1#-2080509171":[{m:"g7-g6",e:9.412},{m:"Ch8-e8",e:9.412},{m:"Hh10-i8",e:9.412}],"1#-156826512":[{m:"Hc3-d5",e:9.444},{m:"Ch3-h7",e:9.444},{m:"Hh1-g3",e:9.444},{m:"Ch3-e3",e:9.444},{m:"Ra1-a2",e:9.444}],"1#-527138250":[{m:"Hh1-g3",e:5}],"-1#-1356255234":[{m:"Hh10-g8",e:5}],"1#1844565171":[{m:"Ri1-h1",e:5}],"-1#1735167875":[{m:"Ra10-a9",e:5}],"1#2134185666":[{m:"Cb3-a3",e:5}],"1#193381617":[{m:"Hh1-g3",e:8},{m:"Ch3-e3",e:8},{m:"i4-i5",e:8}],"-1#1144744249":[{m:"Ri10-i9",e:6.667},{m:"Ec10-e8",e:6.667}],"-1#1360088341":[{m:"Ec10-e8",e:6.667}],"-1#-1248207727":[{m:"Ri10-i9",e:5}],"-1#2078609370":[{m:"g7-g6",e:9.855},{m:"Ra10-b10",e:9.855},{m:"Cb8-a8",e:9.855}],"1#247462055":[{m:"Ch3-h7",e:9.917},{m:"Hb1-c3",e:9.917}],"-1#2056087069":[{m:"Hh10-g8",e:5}],"1#-1202348720":[{m:"Hb1-c3",e:5}],"-1#1558680554":[{m:"Cb8-b9",e:9.917}],"1#1133977923":[{m:"Hb1-c3",e:9.787}],"-1#298797582":[{m:"Ch8-e8",e:9.873},{m:"Hh10-g8",e:9.873},{m:"g7-g6",e:9.873},{m:"Ra10-b10",e:5}],"1#-657622578":[{m:"Hb1-c3",e:5},{m:"g4-g5",e:9.714}],"-1#-1754213370":[{m:"g7-g6",e:9.545},{m:"Hh10-g8",e:9.545}],"1#-1293468646":[{m:"Hb1-c3",e:5}],"-1#-524331177":[{m:"Ra10-b10",e:5}],"1#-911281979":[{m:"Hb1-c3",e:5}],"-1#-1678337144":[{m:"Hb10-c8",e:5}],"1#-1964603084":[{m:"Ra1-b1",e:5}],"-1#-1135969848":[{m:"Eg10-e8",e:5}],"1#2132231479":[{m:"Hh1-i3",e:5}],"-1#1721320713":[{m:"Ra10-a9",e:5}],"1#2126568520":[{m:"Ch3-g3",e:5}],"-1#1614725230":[{m:"Hh10-f9",e:5}],"1#-1755337363":[{m:"Ri1-i2",e:5}],"-1#-1038360315":[{m:"c7-c6",e:5}],"1#24910398":[{m:"c5xc6",e:5}],"-1#1055875562":[{m:"Ee8xc6",e:5}],"1#1412756762":[{m:"Ec1-e3",e:5}],"-1#-422438093":[{m:"Ri10-h10",e:5}],"1#-1131190590":[{m:"Ri2-f2",e:5}],"-1#-1337545544":[{m:"Cg8-e8",e:5}],"1#-1859594664":[{m:"Ad1-e2",e:5}],"-1#-568211624":[{m:"Rh10-h9",e:5}],"1#-620546990":[{m:"Hc3-d5",e:5}],"-1#-247412113":[{m:"Ce8xe4",e:5}],"1#-1288858658":[{m:"Rf2-f8",e:5}],"-1#-833021417":[{m:"Ec6-e8",e:5}],"1#-175396496":[{m:"Cg3-h3",e:5}],"1#745845261":[{m:"Hb1-c3",e:5}],"-1#2116868416":[{m:"Hb10-c8",e:5}],"1#1866255356":[{m:"Hh1-g3",e:5}],"-1#545351220":[{m:"g7-g6",e:5}],"1#1440452937":[{m:"Ec1-e3",e:5}],"-1#-415400096":[{m:"Hh10-g8",e:5}],"1#635798573":[{m:"Ch3-h7",e:5}],"-1#1373051543":[{m:"Hg8-h6",e:5}],"1#-870387176":[{m:"Ch7xc7",e:5}],"-1#-819510831":[{m:"Ec10-e8",e:5}],"1#-474660558":[{m:"Cb3-a3",e:5}],"-1#-802469794":[{m:"Ri10-i9",e:5}],"1#-1853776838":[{m:"Ra1-b1",e:5}],"-1#-1490195258":[{m:"Cb8-a8",e:5}],"1#1848598278":[{m:"Ri1-i2",e:5}],"-1#996873070":[{m:"Ri9-f9",e:5}],"1#791462540":[{m:"Ri2-d2",e:5}],"-1#-2130612625":[{m:"Rf9-f6",e:5}],"1#898666191":[{m:"Rb1-b8",e:5}],"-1#473737333":[{m:"Hh6xg4",e:5}],"1#-1053123784":[{m:"Ca3xa7",e:5}],"-1#-1811922137":[{m:"Ca8xa4",e:5}],"1#1077744898":[{m:"Cc7xi7",e:5}],"1#65582595":[{m:"Hb1-c3",e:9.867},{m:"c4-c5",e:7.5},{m:"Cb3-e3",e:9.867},{m:"Ch3-e3",e:9.867},{m:"Ch3-d3",e:9.867}],"-1#1370545486":[{m:"Hh10-f9",e:9.811},{m:"Eg10-e8",e:9.643},{m:"Hh10-g8",e:9.811},{m:"Hb10-c8",e:9.811},{m:"Eg10-e8",e:9.991}],"-1#960035320":[{m:"Ra10-a9",e:6.667},{m:"Hh10-g8",e:6.667}],"1#560029881":[{m:"Hb1-c3",e:5}],"-1#1933118452":[{m:"Ra9-d9",e:5}],"1#480843351":[{m:"Af1-e2",e:5}],"-1#1156643997":[{m:"Cb8-c8",e:5}],"1#-938559745":[{m:"Ra1-b1",e:5}],"-1#-22919677":[{m:"Hb10-a8",e:5}],"1#-1271593471":[{m:"Ch3-e3",e:5}],"-1#-291336219":[{m:"Hh10-f9",e:5}],"1#432268006":[{m:"Hh1-g3",e:5}],"-1#1451118382":[{m:"Rd9-d4",e:5}],"1#-69205323":[{m:"Hb1-c3",e:5}],"-1#-1447532040":[{m:"Hb10-a8",e:5}],"1#-483448326":[{m:"Ra1-b1",e:5}],"-1#-712779514":[{m:"Ra10-b10",e:5}],"1#-302909537":[{m:"g4-g5",e:5}],"-1#-1590034062":[{m:"a7-a6",e:5}],"1#-1525146512":[{m:"Hh1-g3",e:5}],"-1#-358239816":[{m:"Af10-e9",e:5}],"1#-435260118":[{m:"Eg1-e3",e:5}],"-1#1620538360":[{m:"Ri10-f10",e:5}],"-1#-1448599143":[{m:"Hb10-c8",e:8.75},{m:"Hh10-f9",e:8.75},{m:"Ra10-a9",e:8.75}],"1#1590250650":[{m:"Hb1-c3",e:5}],"-1#1501511655":[{m:"Cb8-c8",e:9.286},{m:"Hb10-c8",e:9.286},{m:"Hh10-g8",e:9.286}],"1#-1683503958":[{m:"Hh1-g3",e:9}],"-1#-2136300581":[{m:"Ri10-i9",e:5}],"1#-1056933953":[{m:"Hh1-g3",e:5}],"-1#-1900160393":[{m:"c7-c6",e:5}],"1#1306141004":[{m:"Ri1-h1",e:5}],"-1#-1511644690":[{m:"Eg10-e8",e:9.99},{m:"Ec10-e8",e:9.99},{m:"Hb10-c8",e:9.99},{m:"Ch8-e8",e:9.99},{m:"Cb8-e8",e:9.99},{m:"Hh10-g8",e:9.99}],"1#1723538705":[{m:"Hb1-c3",e:6.667}],"-1#887322204":[{m:"Hb10-c8",e:6.667},{m:"Af10-e9",e:6.667}],"1#636708064":[{m:"Ra1-b1",e:5}],"-1#325030940":[{m:"Ra10-b10",e:5}],"1#724417157":[{m:"Hh1-g3",e:6.667},{m:"c4-c5",e:6.667}],"-1#1687164749":[{m:"c7-c6",e:5}],"1#-1476924298":[{m:"Rb1-b7",e:5}],"-1#-2027730987":[{m:"Hh10-f9",e:5}],"1#1883384534":[{m:"e4-e5",e:5}],"-1#-137506918":[{m:"Cb8-a8",e:5}],"1#1053817946":[{m:"Rb7xb10",e:5}],"-1#-1826849397":[{m:"Hc8xb10",e:5}],"1#360265991":[{m:"Ri1-i2",e:5}],"-1#1077769583":[{m:"Hb10-c8",e:5}],"1#1361930195":[{m:"Ri2-f2",e:5}],"-1#1576578473":[{m:"Ri10-i9",e:5}],"1#475167181":[{m:"Hg3-e4",e:5}],"-1#-13644590":[{m:"Ch8-h4",e:5}],"1#-626591816":[{m:"e5-e6",e:5}],"-1#1347092501":[{m:"Ch4xe4+",e:5}],"1#79664162":[{m:"Hc3xe4",e:5}],"-1#-465664499":[{m:"g7-g6",e:7.5},{m:"Cb8-b6",e:7.5}],"1#-1855688336":[{m:"Ch3-h7",e:6.667}],"-1#-447287350":[{m:"Hh10-g8",e:6.667}],"1#663622791":[{m:"Hh1-g3",e:7.5}],"-1#1748220239":[{m:"Hg8-f6",e:7.5},{m:"Hg8-h6",e:7.5},{m:"Ad10-e9",e:7.5}],"1#-2064481858":[{m:"Ch7xc7",e:5}],"1#701839154":[{m:"Hh1-i3",e:5}],"-1#811284236":[{m:"Hh10-f9",e:5}],"1#-952477169":[{m:"Ch3-g3",e:5}],"-1#-641448407":[{m:"i7-i6",e:5}],"1#-701921034":[{m:"Ri1-h1",e:5}],"-1#-592129082":[{m:"Af10-e9",e:5}],"1#-803268780":[{m:"Rh1-h5",e:5}],"1#944288462":[{m:"Ra1-b1",e:5}],"-1#249840178":[{m:"a7-a6",e:5}],"1#180772656":[{m:"Hh1-g3",e:5}],"-1#1165751032":[{m:"a6-a5",e:5}],"1#-184457980":[{m:"a4xa5",e:5}],"-1#1296418293":[{m:"Ra10xa5",e:5}],"1#1277368134":[{m:"e4-e5",e:5}],"-1#-877858294":[{m:"Hb10-a8",e:5}],"1#-2126794232":[{m:"Hg3-e4",e:5}],"-1#1648756503":[{m:"Cb8-d8",e:5}],"1#251892708":[{m:"Ch3-h5",e:5}],"-1#2136792551":[{m:"Ra5-a6",e:5}],"1#-2061299011":[{m:"Ch5-i5",e:5}],"-1#1869087807":[{m:"Hh10-i8",e:5}],"1#-418171965":[{m:"Ri1-h1",e:5}],"-1#-309434125":[{m:"i7-i6",e:5}],"1#-496785876":[{m:"Ci5xi8",e:5}],"-1#-864562803":[{m:"Ri10xi8",e:5}],"1#-1619876456":[{m:"Rh1-h7",e:5}],"-1#630767589":[{m:"Ri8-i10",e:5}],"1#2128454006":[{m:"Rh7xg7",e:5}],"-1#244909975":[{m:"Ri10-f10",e:5}],"1#-2024951725":[{m:"He4-g5",e:5}],"-1#-1170302529":[{m:"Ra6-d6",e:5}],"1#1811027217":[{m:"Ad1-e2",e:5}],"-1#620430353":[{m:"Ha8-b6",e:5}],"1#-1591115298":[{m:"Ce3xe7",e:5}],"-1#109558912":[{m:"Cd8-b8",e:5}],"1#1807886451":[{m:"Rb1-a1",e:5}],"-1#1567545487":[{m:"Hb6-d5",e:5}],"1#-1644216072":[{m:"e5-e6",e:5}],"-1#387102549":[{m:"Rd6-d7",e:5}],"1#1161278246":[{m:"Hc3-d1",e:5}],"-1#-1156379316":[{m:"Hd5-f4",e:5}],"1#781661065":[{m:"Hd1-e3",e:5}],"-1#1450409918":[{m:"Ch8-h3",e:5}],"1#-1988878067":[{m:"Hb1-c3",e:5}],"-1#-617854400":[{m:"Hb10-d9",e:5}],"1#-787597990":[{m:"Ra1-b1",e:5}],"-1#-408762970":[{m:"Hh10-i8",e:5}],"1#1876554330":[{m:"Hh1-g3",e:5}],"-1#543448978":[{m:"Ri10-i9",e:5}],"1#1640926198":[{m:"Ri1-i2",e:5}],"-1#881510302":[{m:"Ri9-f9",e:5}],"1#550311548":[{m:"Ri2-d2",e:5}],"-1#-1897874785":[{m:"Ra10-a9",e:5}],"1#-1766251554":[{m:"Rd2-d5",e:5}],"-1#-323751060":[{m:"Rf9-f4",e:5}],"1#-2093178385":[{m:"Hc3-e2",e:5}],"-1#-1470854296":[{m:"Rf4xg4",e:5}],"1#1887413181":[{m:"Ce3-d3",e:5}],"-1#-47035219":[{m:"Cb8-d8",e:5}],"1#-1871194018":[{m:"Cd3xd8",e:5}],"-1#1235538747":[{m:"Ch8xd8",e:5}],"1#868519294":[{m:"Rd5xd8",e:5}],"-1#-625247119":[{m:"Hd9-f8",e:5}],"1#261530704":[{m:"Rb1-b10",e:5}],"-1#-670052371":[{m:"Af10-e9",e:5}],"1#-727446657":[{m:"Rd8-d5",e:5}],"-1#237715026":[{m:"Hf8-g6",e:5}],"1#152801424":[{m:"Rb10-b5",e:5}],"-1#-1678639513":[{m:"Ae9-f10",e:5}],"1#-1755694347":[{m:"Rd5-g5",e:5}],"-1#-437274735":[{m:"Rg4xi4",e:5}],"1#322987652":[{m:"Ch3-h9",e:5}],"-1#-2103645107":[{m:"Ri4-h4",e:5}],"1#-48960523":[{m:"Ch9-b9",e:5}],"-1#85426462":[{m:"Af10-e9",e:5}],"1#163333516":[{m:"Hg3-f5",e:5}],"-1#1598953195":[{m:"Rh4xe4",e:5}],"1#887575628":[{m:"Cb9-b10+",e:5}],"-1#-1880426474":[{m:"Ee8-c10",e:5}],"1#-1552353035":[{m:"Hf5xg7",e:5}],"-1#-509974978":[{m:"Hi8xg7",e:5}],"1#864904852":[{m:"Rg5xg6",e:5}],"-1#-473462136":[{m:"Hg7-e8",e:5}],"1#-1989922914":[{m:"Rg6xg10+",e:5}],"-1#-1838137645":[{m:"Ae9-f10",e:5}],"1#-1629750719":[{m:"Rb5-b8",e:5}],"-1#-234563151":[{m:"Ke10-e9",e:5}],"1#-746003948":[{m:"Rb8xe8+",e:5}],"-1#1489360638":[],"1#-1258933422":[{m:"g4-g5",e:9.986},{m:"Hh1-i3",e:9.986},{m:"Hb1-c3",e:9.986},{m:"c4-c5",e:9.986},{m:"Hh1-g3",e:9.986}],"-1#-130169409":[{m:"Ra10-b10",e:9.722},{m:"c7-c6",e:9.722}],"1#-1068504282":[{m:"Hb1-c3",e:9.333},{m:"Ra1-a2",e:9.333}],"-1#-1843953557":[{m:"Hh10-g8",e:9.892},{m:"Ch8-e8",e:9.892},{m:"Cb8-a8",e:9.892}],"-1#1225679757":[{m:"Cb8-a8",e:5}],"1#-2146676659":[{m:"Hb1-c3",e:5}],"1#995769988":[{m:"Hb1-c3",e:9.643},{m:"Hh1-g3",e:9.643}],"-1#1761760713":[{m:"Hh10-g8",e:9.787},{m:"Eg10-e8",e:9.787},{m:"Ra10-b10",e:9.787}],"-1#1961333580":[{m:"Ch8-f8",e:9.73},{m:"Eg10-e8",e:9.73}],"-1#-1384631444":[{m:"Hh10-g8",e:5}],"1#1872807969":[{m:"e4-e5",e:5}],"-1#-399561363":[{m:"Ad10-e9",e:5}],"1#82711964":[{m:"Ri1-i2",e:5}],"-1#1370118644":[{m:"Ec10-e8",e:5}],"1#2100844823":[{m:"Ri2-f2",e:5}],"-1#1911395181":[{m:"c7-c6",e:5}],"1#-1299552170":[{m:"Hb1-c3",e:5}],"-1#-523107557":[{m:"Hc8-b6",e:5}],"1#1049089130":[{m:"Ch3-h4",e:5}],"-1#-901554474":[{m:"Ch8-i8",e:5}],"1#-140362715":[{m:"Rf2-f6",e:5}],"-1#-1239040593":[{m:"Ra10-d10",e:5}],"1#1879817413":[{m:"Rf6xc6",e:5}],"-1#1865829630":[{m:"Ee8xc6",e:5}],"1#-610291856":[{m:"Hi3-g2",e:5}],"-1#-1374900052":[{m:"Ec6-e8",e:5}],"-1#-424781793":[{m:"g7-g6",e:9.984},{m:"c7-c6",e:9.984},{m:"Ch8-e8",e:9.984},{m:"Ra10-b10",e:9.984},{m:"Hb10-c8",e:9.939},{m:"Ra10-a9",e:9.984},{m:"Cb8-b6",e:9.984}],"1#-1812680862":[{m:"Ra1-a2",e:9.643},{m:"Ra1-b1",e:9.643}],"1#633971492":[{m:"Hb1-c3",e:6.667},{m:"Ra1-b1",e:9.861}],"-1#1011327770":[{m:"Hh10-g8",e:7.5},{m:"Ra10-b10",e:7.5}],"1#-23111593":[{m:"Ra1-b1",e:5}],"-1#-936138581":[{m:"Ra10-b10",e:5}],"1#-264141262":[{m:"Rb1-b7",e:9.524},{m:"Ch3-g3",e:9.524},{m:"Ch3-f3",e:9.524},{m:"g4-g5",e:9.524}],"1#70618499":[{m:"Ch3-g3",e:6.667},{m:"Ra1-b1",e:6.667}],"-1#449548709":[{m:"Hh10-g8",e:6.667},{m:"Hh10-i8",e:6.667}],"-1#848919935":[{m:"Cb8-b4",e:6.667}],"1#-1890306949":[{m:"Ri1-i2",e:6.667}],"1#-2050545372":[{m:"Ra1-b1",e:6.667}],"1#-555977082":[{m:"Ra1-a2",e:9.98}],"1#611754834":[{m:"Hh1-g3",e:9.767}],"1#-17317538":[{m:"Hh1-g3",e:6.667},{m:"Ra1-b1",e:6.667}],"1#726001952":[{m:"Ra1-b1",e:5}],"-1#-78930278":[{m:"Ra10-b10",e:7.5},{m:"Hb10-c8",e:6.667}],"1#-1019629565":[{m:"c4-c5",e:6.667},{m:"Ri1-i2",e:6.667}],"-1#204115083":[{m:"Cb8-a8",e:5}],"1#-987185333":[{m:"Hb1-c3",e:5}],"-1#-1770128277":[{m:"Hh10-g8",e:5}],"1#1420101414":[{m:"g4-g5",e:6.667},{m:"Hb1-c3",e:6.667}],"-1#409924043":[{m:"c7-c6",e:5}],"1#-620164368":[{m:"Hg3-f5",e:5}],"-1#117271659":[{m:"c7-c6",e:5}],"1#-979724464":[{m:"Ri2-f2",e:5}],"1#965961175":[{m:"Ri1-i2",e:6.667},{m:"g4-g5",e:6.667}],"-1#1826040255":[{m:"Hh10-g8",e:5}],"-1#1968739130":[{m:"c7-c6",e:5}],"1#-1237358591":[{m:"Hg3-h5",e:9.545},{m:"Hb1-c3",e:9.545},{m:"Hb1-a3",e:9.545}],"1#-963686187":[{m:"Ce3xe7+",e:8.333},{m:"Hb1-c3",e:8.333}],"-1#1629580683":[{m:"Af10-e9",e:5}],"1#1837803801":[{m:"Hb1-c3",e:5}],"-1#1070776916":[{m:"Hb10-c8",e:5}],"1#784519400":[{m:"Ce7-e6",e:5}],"-1#-718918195":[{m:"Ra10-b10",e:5}],"1#-313261228":[{m:"Ri1-i2",e:5}],"-1#-1206890692":[{m:"Hh10-g8",e:5}],"1#2059973745":[{m:"Ri2-f2",e:5}],"-1#1981644299":[{m:"Ri10-h10",e:5}],"1#744227834":[{m:"Rf2-f3",e:5}],"-1#-275638286":[{m:"Cb8-b3",e:5}],"1#-1052231878":[{m:"Eg1-e3",e:5}],"-1#1204892136":[{m:"Rb10-b6",e:5}],"1#885213310":[{m:"Rf3-f6",e:5}],"-1#-1420301683":[{m:"Rh10xh3",e:5}],"1#-1921748855":[{m:"Hh1-f2",e:5}],"-1#-1155419624":[{m:"Rh3-h5",e:5}],"1#-1573392563":[{m:"g4-g5",e:5}],"-1#-285468256":[{m:"Rh5-h2",e:5}],"1#1764423068":[{m:"Ra1-a2",e:5}],"-1#-529826505":[{m:"Eg10-i8",e:5}],"1#-1101040035":[{m:"c4-c5",e:5}],"-1#1900825301":[{m:"g7-g6",e:5}],"1#68599208":[{m:"Rf6-f8",e:5}],"-1#624460442":[{m:"Rb6xe6",e:5}],"1#1566600207":[{m:"Rf8xg8",e:5}],"-1#-1874161047":[{m:"Re6-f6",e:5}],"1#-1076470068":[{m:"Rg8xi8",e:5}],"-1#-1980285808":[{m:"Ce8-f8",e:5}],"1#878321907":[{m:"Hc3-d5",e:5}],"-1#505011918":[{m:"Rf6-f3",e:5}],"1#-1023579481":[{m:"Hd5-f6",e:5}],"-1#1809846547":[{m:"Rf3xf6",e:5}],"1#-1246096149":[{m:"g5xg6",e:5}],"-1#-560526083":[{m:"Rf6-f3",e:5}],"1#41138324":[{m:"Ad1-e2",e:5}],"-1#-1797833832":[{m:"Hh10-g8",e:8},{m:"Hb10-a8",e:8}],"1#1443872981":[{m:"Hb1-c3",e:6.667},{m:"Ra1-b1",e:7.5}],"-1#1333903595":[{m:"Hb10-c8",e:7.5},{m:"Ri10-h10",e:7.5}],"1#1586614871":[{m:"Ra1-b1",e:6.667}],"-1#1748837035":[{m:"Ri10-h10",e:6.667},{m:"Ra10-b10",e:6.667}],"1#847011674":[{m:"Ri1-h1",e:5}],"-1#954270826":[{m:"Ra10-b10",e:5}],"1#9644787":[{m:"Rb1-b7",e:5}],"-1#541557072":[{m:"Cb8-a8",e:5}],"1#-381308272":[{m:"Rb7xc7",e:5}],"1#1347357746":[{m:"Rb1-b7",e:5}],"-1#1889249169":[{m:"Cb8-a8",e:5}],"1#-1181117359":[{m:"Rb7xc7",e:5}],"-1#-843664227":[{m:"Rb10-b8",e:5}],"1#-993410932":[{m:"Ri1-h1",e:5}],"1#364952858":[{m:"Ra1-b1",e:5}],"-1#594300390":[{m:"Rh10xh3",e:5}],"1#89118690":[{m:"Rb1xb8",e:5}],"-1#-2110648557":[{m:"Hb10-a8",e:5}],"1#-928690415":[{m:"Ri1-h1",e:5}],"-1#-1036512223":[{m:"Rh3xh1",e:5}],"1#1329724818":[{m:"Hi3xh1",e:5}],"-1#360557375":[{m:"Ra10-b10",e:5}],"1#755991974":[{m:"Rb8xb10",e:5}],"-1#-1985705618":[{m:"Ha8xb10",e:5}],"1#1413914460":[{m:"g4-g5",e:5}],"-1#411920817":[{m:"c7-c6",e:5}],"1#-605384054":[{m:"Hh1-g3",e:5}],"-1#-1806221502":[{m:"Hb10-c8",e:5}],"-1#1621307433":[{m:"Hb10-c8",e:6.667}],"1#1907565205":[{m:"Hh1-g3",e:7.5},{m:"Ch3-f3",e:7.5}],"-1#1041141597":[{m:"Ri10-h10",e:5}],"1#1682961068":[{m:"Rb1-b7",e:5}],"-1#1151031567":[{m:"Ec10-a8",e:5}],"1#-275733682":[{m:"Ri1-h1",e:5}],"-1#-452069250":[{m:"Rh10-h6",e:5}],"1#1088045348":[{m:"Ch3-i3",e:5}],"-1#1424978988":[{m:"Ad10-e9",e:6.667},{m:"Ra10-a9",e:6.667}],"1#-1204925219":[{m:"Rb1-b7",e:5}],"-1#-1728387202":[{m:"Ec10-a8",e:5}],"1#1287056749":[{m:"Hh1-g3",e:5}],"-1#51069093":[{m:"Ra9-f9",e:5}],"1#-566199398":[{m:"Ra1-b1",e:5}],"-1#-387151002":[{m:"Ra10-b10",e:5}],"1#-794909185":[{m:"Hh1-g3",e:5}],"-1#-1625094089":[{m:"Hh10-g8",e:5}],"1#1576792954":[{m:"Ri1-h1",e:5}],"-1#1466345546":[{m:"Ri10-i9",e:5}],"1#382499886":[{m:"g4-g5",e:5}],"-1#1510443715":[{m:"Ri9-f9",e:5}],"1#1312840481":[{m:"Rb1-b5",e:5}],"-1#384723226":[{m:"Cb8-c8",e:5}],"1#-1710218376":[{m:"Rb5xb10",e:5}],"-1#1337539377":[{m:"Ha8xb10",e:5}],"1#-1839518461":[{m:"Ch3-h5",e:5}],"-1#-503028992":[{m:"Hb10-a8",e:5}],"1#-1466752254":[{m:"Hg3-f5",e:5}],"-1#-27168667":[{m:"Rf9-d9",e:5}],"1#150945609":[{m:"Af1-e2",e:5}],"1#-1873930682":[{m:"Ra1-a2",e:9.911},{m:"Hb1-c3",e:9.911}],"-1#420454125":[{m:"Hb10-c8",e:9.474},{m:"Ce8xe4+",e:9.474}],"1#136285265":[{m:"Hb1-c3",e:9.444},{m:"Ra2-f2",e:9.444}],"-1#1514661660":[{m:"Ra10-b10",e:9.667},{m:"c7-c6",e:9.667},{m:"Ch8-f8",e:9.667},{m:"Hh10-g8",e:9.667}],"1#1647692165":[{m:"Hb1-c3",e:7.5}],"-1#-803782487":[{m:"Rb10-b6",e:9.643},{m:"c7-c6",e:9.643}],"1#-1725948889":[{m:"Ra2-f2",e:5}],"1#-1734402991":[{m:"Ra2-f2",e:6.667}],"-1#-1170406019":[{m:"Ad10-e9",e:8},{m:"Ra10-b10",e:8}],"1#1459371404":[{m:"Hb1-c3",e:5}],"-1#77878977":[{m:"Ra10-b10",e:5}],"1#1020688472":[{m:"Rf2-f9",e:7.5}],"1#-2108740636":[{m:"Hb1-c3",e:7.5}],"1#1533200220":[{m:"Af1-e2",e:5}],"-1#54209942":[{m:"Ch8-e8",e:5}],"1#1616010413":[{m:"Hb1-c3",e:5}],"-1#839530464":[{m:"Ce4-e6",e:5}],"1#1976411739":[{m:"Hh1-g3",e:5}],"-1#980421523":[{m:"Hh10-g8",e:5}],"1#-123146018":[{m:"Ri1-h1",e:5}],"-1#-231363602":[{m:"Ri10-h10",e:5}],"1#-1468738017":[{m:"Ch3-h7",e:5}],"-1#-599373659":[{m:"g7-g6",e:5}],"1#-1457733672":[{m:"Hc3-e4",e:5}],"-1#-1801753515":[{m:"Ra10-a9",e:5}],"1#-1933380332":[{m:"Ra2-d2",e:5}],"-1#1489385262":[{m:"Ra9-f9",e:5}],"1#-1613742176":[{m:"Rd2-d7",e:5}],"-1#34572091":[{m:"Hb10-a8",e:5}],"1#1217972025":[{m:"Ce3xe6",e:5}],"-1#-1038713589":[{m:"c7-c6",e:9.894},{m:"Ra10-a9",e:9.894},{m:"Hb10-c8",e:9.894}],"1#24217136":[{m:"Ra1-b1",e:5}],"-1#937260748":[{m:"Hb10-c8",e:5}],"1#650994800":[{m:"Rb1-b5",e:9.615},{m:"Hh1-g3",e:9.615},{m:"g4-g5",e:9.615},{m:"Ch3-f3",e:9.615},{m:"Hh1-i3",e:9.615}],"-1#2120439371":[{m:"Ra10-b10",e:5}],"-1#1768999352":[{m:"g7-g6",e:9}],"-1#59847369":[{m:"Af10-e9",e:5}],"-1#1061381198":[{m:"Hh10-g8",e:8.333}],"1#-632298422":[{m:"c4-c5",e:9.474},{m:"Ra1-b1",e:9.474},{m:"Ce3xe7+",e:9.474},{m:"Hh1-g3",e:9.474}],"-1#358406338":[{m:"Ra9-f9",e:5}],"1#-766848948":[{m:"g4-g5",e:5}],"-1#-320662346":[{m:"Hb10-c8",e:9.286}],"1#-34404854":[{m:"Rb1-b5",e:9.744}],"-1#2111953172":[{m:"Af10-e9",e:6.667}],"-1#-1779283582":[{m:"Hb10-c8",e:6.667},{m:"Ra9-f9",e:6.667}],"1#-754552905":[{m:"Ra1-b1",e:9.867},{m:"Hh1-g3",e:9.867},{m:"Hb1-c3",e:9.444},{m:"c4-c5",e:9.867}],"-1#-441802933":[{m:"Hh10-g8",e:9.818},{m:"Hb10-c8",e:5}],"-1#-1665416577":[{m:"Hh10-g8",e:7.5},{m:"Hb10-c8",e:6.667}],"-1#471159615":[{m:"Ra10-b10",e:5}],"1#610762150":[{m:"Ra1-b1",e:5}],"-1#315329882":[{m:"Rb10xb1",e:5}],"1#1732172451":[{m:"g4-g5",e:9.946},{m:"Hh1-g3",e:9.946},{m:"Hb1-c3",e:9.946},{m:"c4-c5",e:9.946}],"-1#737487950":[{m:"Ec10-e8",e:9.412},{m:"Cb8-d8",e:9.412},{m:"c7-c6",e:9.412}],"1#124202157":[{m:"Hh1-g3",e:5}],"-1#1222279525":[{m:"Ri10-i9",e:5}],"1#158356737":[{m:"Ch3-i3",e:5}],"-1#2127272478":[{m:"Ch8-h4",e:5}],"1#1531093364":[{m:"Ri1-h1",e:5}],"1#1185986749":[{m:"Hb1-c3",e:8.333},{m:"Hh1-g3",e:8.333}],"-1#350802928":[{m:"c7-c6",e:8.75},{m:"Ra10-a9",e:8.75}],"-1#151852405":[{m:"Hb10-c8",e:8}],"1#-393029771":[{m:"Ra1-a2",e:9.167},{m:"Hb1-c3",e:9.167},{m:"Cb3-e3",e:7.5}],"-1#-1161118664":[{m:"c7-c6",e:8.75}],"-1#679704427":[{m:"Cb8-d8",e:6.667},{m:"Hb10-c8",e:6.667}],"1#1170662296":[{m:"Ra1-a2",e:5}],"-1#-863540429":[{m:"Hb10-c8",e:5}],"1#-577275505":[{m:"Ra2-d2",e:5}],"-1#160676789":[{m:"Ra10-b10",e:5}],"1#836867372":[{m:"Hb1-c3",e:5}],"-1#1673133665":[{m:"Rb10-b6",e:8},{m:"Af10-e9",e:8}],"1#279676919":[{m:"g4-g5",e:6.667},{m:"Ch3-h5",e:6.667}],"1#1863465715":[{m:"e4-e5",e:6.667}],"-1#-392306753":[{m:"g7-g6",e:6.667}],"-1#895922670":[{m:"c7-c6",e:9.939},{m:"Hb10-c8",e:9.939},{m:"Ch8-i8",e:9.939},{m:"Ra10-a9",e:9.939},{m:"Hb10-a8",e:9.939},{m:"g7-g6",e:9.939},{m:"Cb8-d8",e:9.939},{m:"Ri10-i9",e:9.939}],"1#-167687467":[{m:"Ra1-a2",e:9}],"1#143119133":[{m:"Ra1-b1",e:9}],"1#759113903":[{m:"Ad1-e2",e:9.333}],"1#2146562540":[{m:"Ra1-b1",e:8}],"-1#1230831888":[{m:"Ra10-a9",e:8}],"1#1077692051":[{m:"Ra1-b1",e:8},{m:"Hb1-c3",e:9.928}],"1#1478698269":[{m:"Ch3-h7",e:9.909}],"1#1959552394":[{m:"g4-g5",e:5}],"-1#940020583":[{m:"Ec10-e8",e:5}],"-1#1010351896":[{m:"Hb10-c8",e:5}],"1#757640612":[{m:"Hb1-c3",e:5}],"-1#2138097385":[{m:"Ra10-b10",e:5}],"1#1191372912":[{m:"Ra1-b1",e:5}],"-1#1907234956":[{m:"Hh10-g8",e:5}],"1#-1284054079":[{m:"c4-c5",e:7.5},{m:"g4-g5",e:7.5}],"-1#2087051081":[{m:"Eg10-e8",e:6.667},{m:"g7-g6",e:6.667}],"1#-1086790730":[{m:"g4-g5",e:5}],"-1#-202173093":[{m:"g7-g6",e:5}],"1#-2035686874":[{m:"g5xg6",e:5}],"-1#-310052304":[{m:"Ee8xg6",e:5}],"1#-1170230929":[{m:"Hh1-g3",e:5}],"-1#-176022361":[{m:"Eg6-e8",e:5}],"1#-1677068818":[{m:"Hg3-h5",e:5}],"-1#-1383423377":[{m:"Ch8-h10",e:5}],"1#-1856733705":[{m:"Rb1-b7",e:5}],"-1#-1316956588":[{m:"Ch10-g10",e:5}],"1#744200163":[{m:"Eg1-e3",e:5}],"-1#-1430089423":[{m:"Cb8-a8",e:5}],"1#1673569009":[{m:"Rb7xc7",e:5}],"-1#401572413":[{m:"Rb10-b8",e:5}],"1#512816684":[{m:"c5-c6",e:5}],"-1#1900748944":[{m:"Ee8xc6",e:5}],"1#462468192":[{m:"Rc7xc6",e:5}],"-1#-1241277395":[{m:"Ca8-a9",e:5}],"1#1126567637":[{m:"Ca3xa7",e:5}],"-1#370988746":[{m:"Ec10-e8",e:5}],"1#982439465":[{m:"Rc6-c5",e:5}],"-1#514036631":[{m:"Ri10-i9",e:5}],"1#1594443763":[{m:"Af1-e2",e:5}],"-1#122727737":[{m:"Ri9-d9",e:5}],"1#-128711546":[{m:"Ri1-f1",e:5}],"-1#-719807412":[{m:"Ad10-e9",e:5}],"1#970564797":[{m:"Ca7xi7",e:5}],"-1#-1523707175":[{m:"Ca9-c9",e:5}],"1#-578256419":[{m:"Rc5-d5",e:5}],"-1#1643066434":[{m:"Rd9xd5",e:5}],"1#1052373470":[{m:"Hc3xd5",e:5}],"-1#-1684384938":[{m:"Hg8xi7",e:5}],"1#759589750":[{m:"Hh5xi7",e:5}],"-1#-1763079412":[{m:"Rb8-b7",e:5}],"1#2044305586":[{m:"Hd5-f6",e:5}],"-1#-792405242":[{m:"Hc8-d6",e:5}],"1#-92901243":[{m:"Hi7-g8",e:5}],"-1#-1726716283":[{m:"Ee8-g6",e:5}],"1#-2135341223":[{m:"Ch3-h10",e:5}],"-1#536173120":[{m:"Rb7-b8",e:5}],"1#-255495682":[{m:"Hg8xe7",e:5}],"-1#-1053458072":[{m:"Rb8-h8",e:5}],"1#-444544734":[{m:"Ch10-i10",e:5}],"-1#-1591632252":[{m:"Eg6-e8",e:5}],"1#-1198735528":[{m:"Rf1-g1",e:5}],"-1#-373262146":[{m:"Cg10-h10",e:5}],"1#1947941129":[{m:"Ci10-i5",e:5}],"-1#675224646":[{m:"Cc9-d9",e:5}],"1#257099485":[{m:"Ci5-e5",e:5}],"-1#-1087450059":[{m:"Rh8-f8",e:5}],"1#1952601329":[{m:"He7-g8",e:5}],"-1#-1102898964":[{m:"Ch10-g10",e:5}],"1#597186907":[{m:"Rg1-h1",e:5}],"-1#1426414919":[{m:"Cg10-g9",e:5}],"1#-781982763":[{m:"Rh1-h7",e:5}],"-1#1804204456":[{m:"Cg9-f9",e:5}],"1#-1018885089":[{m:"Rh7-d7",e:5}],"-1#182837076":[{m:"Hd6-f5",e:5}],"1#-1376211207":[{m:"Ee3-g5",e:5}],"-1#-496035300":[{m:"Cd9-c9",e:5}],"1#-989659001":[{m:"Rd7-a7",e:5}],"-1#-1652117617":[{m:"Ke10-d10",e:5}],"1#-462419210":[{m:"Ra7-a10+",e:5}],"-1#-306535298":[{m:"Cc9-c10",e:5}],"1#272027724":[{m:"Hf6xe8",e:5}],"-1#-480384159":[{m:"Rf8xe8",e:5}],"1#1011741586":[{m:"Ra10xc10+",e:5}],"-1#-1218901341":[{m:"Kd10-d9",e:5}],"1#-1854904192":[{m:"Hg8-h6",e:5}],"-1#-771382696":[{m:"Hf5-g3",e:5}],"1#216438194":[{m:"Ce5-d5",e:5}],"-1#1923613147":[{m:"Re8xe4",e:5}],"1#-1847427904":[{m:"Rc10-c6",e:5}],"-1#1863107464":[{m:"Kd9-d10",e:5}],"1#1227202987":[{m:"Cd5-d3",e:5}],"-1#-1639929229":[{m:"Ae9-f8",e:5}],"1#-727880321":[{m:"Rc6-d6+",e:5}],"-1#305229325":[{m:"Kd10-e10",e:5}],"1#1808255860":[{m:"Cd3-e3+",e:5}],"-1#-1345363911":[{m:"Cf9-e9",e:5}],"1#-1288767740":[{m:"Rd6-f6",e:5}],"-1#657104468":[{m:"Hg3xi4",e:5}],"1#-114943248":[{m:"Hh6-i8",e:5}],"-1#-1727326496":[{m:"Ce9xe3+",e:5}],"1#628931900":[{m:"Ec1xe3",e:5}],"-1#1254987917":[{m:"Af10-e9",e:5}],"1#1181113375":[{m:"Hi8-g9+",e:5}],"-1#153511155":[{m:"Ke10-f10",e:5}],"1#1953382401":[{m:"a4-a5",e:5}],"-1#1510008141":[{m:"Re4-h4",e:5}],"1#1350742785":[{m:"Hg9-e8",e:5}],"-1#492960349":[{m:"Kf10-f9",e:5}],"1#641617562":[{m:"Rf6-f7",e:5}],"-1#-1587909482":[{m:"Rh4-a4",e:5}],"1#1959313644":[{m:"Rf7-i7",e:5}],"-1#-747242850":[{m:"Hi4-h6",e:5}],"1#1836123667":[{m:"Ri7-h7",e:5}],"-1#-439789384":[{m:"Hh6-f5",e:5}],"1#470795196":[{m:"He8-f6",e:5}],"-1#-447973801":[{m:"Ae9-d8",e:5}],"1#1805549361":[{m:"Hf6-g8",e:5}],"-1#-1289323102":[{m:"Kf9-e9",e:5}],"1#-725756366":[{m:"Rh7-f7",e:5}],"-1#-429554278":[{m:"Hf5-g3",e:5}],"1#948351600":[{m:"Rf7xf8",e:5}],"-1#550572324":[{m:"Ke9-d9",e:5}],"1#1585638875":[{m:"Rf8-f3",e:5}],"-1#-35305621":[{m:"Hg3-h5",e:5}],"1#-247132887":[{m:"Rf3-f5",e:5}],"-1#-750279946":[{m:"Hh5-g7",e:5}],"1#155134004":[{m:"Ch3-d3",e:9.923},{m:"Hh1-g3",e:9.923},{m:"Ch3-e3",e:9.923},{m:"Rb1-b7",e:9.923},{m:"Eg1-e3",e:9.923},{m:"Hh1-i3",e:9.923},{m:"Ch3-g3",e:9.923},{m:"Ch3-h7",e:9.923}],"-1#-1971503636":[{m:"Hg8-h6",e:9.63},{m:"Eg10-e8",e:9.63},{m:"Ri10-h10",e:9.63},{m:"Ri10-i9",e:9.63},{m:"Cb8-b6",e:9.63},{m:"Cb8-b4",e:9.63},{m:"Hg8-f6",e:9.63},{m:"Ec10-e8",e:9.63}],"1#397727075":[{m:"Hh1-g3",e:5}],"1#-801357795":[{m:"Hh1-g3",e:8.75}],"1#1201048787":[{m:"Eg1-e3",e:7.5}],"1#934311144":[{m:"Hc3-d5",e:5}],"1#-1494270705":[{m:"Hh1-g3",e:9.87}],"-1#1182959100":[{m:"Ch8-h6",e:9.643},{m:"Eg10-e8",e:9.643},{m:"Cb8-b3",e:9.643},{m:"Cb8-b4",e:9.643},{m:"Ec10-e8",e:9.643},{m:"Ri10-i9",e:9.643}],"1#2102132478":[{m:"Rb1-b7",e:6.667}],"1#-2048935677":[{m:"Ch3-h7",e:7.5}],"1#1750639924":[{m:"Hc3-d5",e:5}],"-1#1109089033":[{m:"Cb3xh3",e:5}],"1#-78656264":[{m:"Eg1-e3",e:8}],"1#1779467551":[{m:"Rb1-b5",e:9.655}],"1#120082840":[{m:"Hh1-g3",e:9.091}],"-1#1403560400":[{m:"Eg10-e8",e:9.412},{m:"Ec10-e8",e:9.412},{m:"Ri10-h10",e:9.412}],"1#-1862951633":[{m:"Hh1-g3",e:5}],"-1#-548917017":[{m:"Ri10-h10",e:6.667},{m:"Cb8-b6",e:6.667}],"1#2134548787":[{m:"Hh1-g3",e:9.643}],"-1#814157051":[{m:"Ri10-i9",e:9.697},{m:"Ri10-h10",e:9.697},{m:"Hg8-f6",e:9.697}],"1#166321185":[{m:"Rb1-b7",e:9.375},{m:"Hh1-g3",e:9.375}],"-1#691894146":[{m:"Cb8-a8",e:6.667}],"-1#703300503":[{m:"Cb8-b9",e:9.091},{m:"Hg8-f6",e:9.091},{m:"Ch8-h7",e:9.091},{m:"Eg10-e8",e:9.091},{m:"Cb8-a8",e:9.091}],"1#-728743652":[{m:"Hh1-g3",e:5}],"-1#-1691489068":[{m:"Cb9-f9",e:5}],"1#-1952819420":[{m:"Ca3xa7",e:5}],"1#1851280480":[{m:"Ch3-e3",e:5}],"1#-357122200":[{m:"Eg1-e3",e:6.667},{m:"Ch3-d3",e:6.667}],"1#-521555881":[{m:"Rb7xb10",e:8.571}],"-1#1295659398":[{m:"Hc8xb10",e:8.571}],"-1#-1884934426":[{m:"Eg10-e8",e:9.6},{m:"Ec10-e8",e:9.6},{m:"Ri10-i9",e:9.6},{m:"Ch8-i8",e:9.6}],"1#1291522585":[{m:"Rb1-b5",e:9.091},{m:"Hh1-g3",e:9.091}],"1#-1556861435":[{m:"Rb1-b7",e:8.889},{m:"Hh1-g3",e:8.889},{m:"Ca3xa7",e:8.889}],"1#-838010238":[{m:"Hh1-g3",e:9.091},{m:"Ch3-h7",e:9.091}],"1#-1303950315":[{m:"Rb1-b7",e:7.5},{m:"Hh1-f2",e:7.5}],"-1#280045578":[{m:"i7-i6",e:6.667},{m:"Eg10-e8",e:6.667}],"1#526182101":[{m:"Ec1-e3",e:5}],"-1#-1380316932":[{m:"Ri10-i9",e:5}],"1#-334439272":[{m:"Ch3-f3",e:5}],"-1#-917730783":[{m:"Ri9-f9",e:5}],"1#-586458173":[{m:"Af1-e2",e:5}],"1#-739502859":[{m:"Ch3-g3",e:5}],"-1#-854456109":[{m:"Hg8-h6",e:5}],"1#1356587100":[{m:"Ri1-i2",e:5}],"-1#94350388":[{m:"Af10-e9",e:5}],"1#154429606":[{m:"Ri2-f2",e:5}],"-1#398537746":[{m:"Ri10-h10",e:5}],"1#1300253155":[{m:"Hh1-i3",e:5}],"-1#1410222557":[{m:"Ch8-i8",e:5}],"1#1777281838":[{m:"Rb1-b7",e:5}],"-1#1228636301":[{m:"Cb8-a8",e:5}],"1#-2143702195":[{m:"Rb7xb10",e:5}],"-1#770323100":[{m:"Hc8xb10",e:5}],"1#-1416661488":[{m:"g4-g5",e:5}],"-1#-414940931":[{m:"Hg8-f6",e:5}],"1#1161122894":[{m:"g5xg6",e:5}],"-1#773344344":[{m:"Hf6xe4",e:5}],"1#592188147":[{m:"Hc3xe4",e:5}],"-1#694017850":[{m:"Ci8-e8",e:5}],"-1#2098050702":[{m:"Ec10-e8",e:9.706},{m:"Eg10-e8",e:9.706},{m:"Hg8-h6",e:9.706},{m:"Cb8-b4",e:9.706}],"1#1369421421":[{m:"Hh1-i3",e:9.545},{m:"Hh1-g3",e:9.545}],"1#-1102017935":[{m:"Ch7xc7",e:5}],"-1#-1117177416":[{m:"Ri10-h10",e:5}],"1#-524001791":[{m:"Hh1-i3",e:9.333},{m:"Ri1-i2",e:9.333}],"1#-1061093494":[{m:"Hh1-g3",e:5}],"-1#-1887612350":[{m:"Hg8-f6",e:6.667}],"-1#-4385492":[{m:"c7-c6",e:6.667}],"1#1020980759":[{m:"Rb1-b7",e:8.889},{m:"Hh1-g3",e:8.889}],"-1#470697396":[{m:"Ch8-h4",e:9.444},{m:"Cb8-a8",e:9.444},{m:"Ch8-i8",e:9.444},{m:"Hc8-d6",e:9.444},{m:"Ri10-i9",e:9.444}],"1#965181150":[{m:"c4-c5",e:7.5},{m:"Eg1-e3",e:7.5},{m:"Hh1-g3",e:7.5}],"-1#-158055850":[{m:"c6xc5",e:5}],"1#-840133694":[{m:"Rb7-c7",e:5}],"-1#926011948":[{m:"Hg8-e9",e:5}],"1#1780146798":[{m:"Rc7xc5",e:5}],"-1#-885689925":[{m:"Cb8-b9",e:5}],"1#911127344":[{m:"Hh1-g3",e:5}],"-1#-1088522228":[{m:"Ch4xc4",e:5}],"1#1181172356":[{m:"Hh1-g3",e:5}],"-1#165343052":[{m:"Ri10-h10",e:5}],"1#1402704573":[{m:"Ri1-h1",e:5}],"-1#1493617037":[{m:"Rh10-h4",e:5}],"1#-1656281382":[{m:"Ch3-i3",e:5}],"-1#1983566614":[{m:"Ch4-g4",e:5}],"1#1730195130":[{m:"Ri1-h1",e:5}],"-1#1841165706":[{m:"Ri10-h10",e:5}],"1#939296891":[{
m:"Ch3-h5",e:5}],"-1#1201915512":[{m:"Hc8-d6",e:5}],"1#1829858811":[{m:"Eg1-e3",e:5}],"1#-720603532":[{m:"Rb7xb10",e:8.75},{m:"Rb7-c7",e:8.75}],"-1#2027943845":[{m:"Hc8xb10",e:8.571}],"1#-21318871":[{m:"Hh1-g3",e:8.571},{m:"Ca3xa7",e:8.571}],"-1#-1324933407":[{m:"Hb10-c8",e:8.333}],"1#-1609102243":[{m:"Ec1-e3",e:9.375},{m:"Hg3-h5",e:9.375}],"-1#-1417647306":[{m:"Hb10-c8",e:5}],"1#-1164936822":[{m:"Ca7xg7",e:5}],"-1#907274638":[{m:"Ch8-h4",e:5}],"-1#802240410":[{m:"Rb10-b8",e:9.091},{m:"Ca8-a9",e:9.091}],"1#648954763":[{m:"Hh1-g3",e:5}],"-1#1762913859":[{m:"Eg10-e8",e:5}],"1#-1437674820":[{m:"Hg3-h5",e:5}],"-1#-1681029827":[{m:"Ch8xh3",e:5}],"1#-621501086":[{m:"Ch3-g3",e:9},{m:"Hh1-g3",e:9}],"-1#-1005930172":[{m:"Ri10-h10",e:5}],"-1#-1790375766":[{m:"Hg8-e9",e:8.889}],"1#569321287":[{m:"Hh1-g3",e:5}],"-1#1850903183":[{m:"Ri10-h10",e:5}],"1#873723774":[{m:"Hg3-f5",e:5}],"-1#1658954777":[{m:"Cb8-a8",e:5}],"1#-1411147815":[{m:"Rb7-c7",e:5}],"-1#1363072567":[{m:"Ca8-a9",e:5}],"1#-1541716785":[{m:"Hf5xg7",e:5}],"-1#-419833340":[{m:"Ca9-c9",e:5}],"1#-1637922560":[{m:"Rc7-d7",e:5}],"-1#-1346529590":[{m:"Hc8-b6",e:5}],"1#1911046587":[{m:"Hg7xi8",e:5}],"-1#1291011625":[{m:"Eg10xi8",e:5}],"1#-1890316614":[{m:"Ch3-g3",e:5}],"-1#-1851125092":[{m:"Hg8-f6",e:5}],"1#870041135":[{m:"Rd7xe7+",e:5}],"-1#1569706570":[{m:"Cc9-e9",e:5}],"1#265738249":[{m:"Eg1-e3",e:5}],"-1#-1991254309":[{m:"Hf6-d5",e:5}],"1#-673442538":[{m:"Re7-e5",e:5}],"-1#-1123969913":[{m:"Hd5xc3",e:5}],"1#918351415":[{m:"Rb7-d7",e:8},{m:"Hh1-g3",e:8}],"-1#-530692254":[{m:"Hd6xc4",e:5}],"1#1552154729":[{m:"Hh1-g3",e:5}],"-1#322547105":[{m:"Cb8-c8",e:5}],"1#-1614288957":[{m:"Ca3xa7",e:5}],"-1#-889372708":[{m:"Eg10-e8",e:5}],"1#161481507":[{m:"Ca7xe7+",e:5}],"-1#1358644069":[{m:"Hg8xe7",e:5}],"1#239150036":[{m:"Rd7xe7",e:5}],"-1#461462644":[{m:"Af10-e9",e:5}],"-1#2030126079":[{m:"Hc8-d6",e:7.5}],"1#950769563":[{m:"Rb7-b5",e:8},{m:"Rb7-d7",e:8}],"-1#1561082226":[{m:"c6-c5",e:6.667}],"1#-752479469":[{m:"Rb5xc5",e:6.667}],"-1#-311201855":[{m:"Cb8-c8",e:6.667}],"1#1636640163":[{m:"Ri1-i2",e:6.667}],"-1#885615051":[{m:"Rb10-b6",e:6.667},{m:"Ri9-f9",e:6.667}],"1#1205538909":[{m:"Ri2-d2",e:5}],"-1#-369705794":[{m:"Ri9-f9",e:5}],"1#-38703780":[{m:"Ca3xa7",e:5}],"-1#-1467239101":[{m:"Rf9-f6",e:5}],"1#546224169":[{m:"Ca3xa7",e:5}],"-1#1974755382":[{m:"Rb10-b7",e:5}],"1#-1910109976":[{m:"Ca7-a6",e:5}],"-1#1693889387":[{m:"Rf9-f4",e:5}],"-1#-297189682":[{m:"Hd6xc4",e:6.667}],"1#1385396677":[{m:"Ca3xa7",e:6.667}],"-1#128557530":[{m:"Rb10-b9",e:6.667},{m:"Ri9-f9",e:6.667}],"1#1493057030":[{m:"Ch3-i3",e:5}],"-1#793112857":[{m:"Hc4-b6",e:5}],"1#14957292":[{m:"Rd7-b7",e:5}],"-1#-704212039":[{m:"Cb8-c8",e:5}],"1#1526258139":[{m:"Rb7xb9",e:5}],"1#334393400":[{m:"Eg1-e3",e:5}],"-1#-1787332886":[{m:"Rf9-f4",e:5}],"1#-84401047":[{m:"Af1-e2",e:5}],"-1#-1566454109":[{m:"Rf4-g4",e:5}],"1#-926348950":[{m:"Ri1-g1",e:5}],"1#1571066320":[{m:"Rb1-b7",e:5}],"-1#303643672":[{m:"Ri9-f9",e:7.5},{m:"Hc8-d6",e:7.5}],"1#106884602":[{m:"Ch3-i3",e:6.667}],"-1#1910842085":[{m:"Ch8-h4",e:6.667}],"1#1416370575":[{m:"c4-c5",e:6.667}],"-1#-1686166265":[{m:"c6xc5",e:6.667}],"1#-1610091373":[{m:"Rb7-c7",e:6.667}],"-1#1524282749":[{m:"Hc8-e9",e:6.667},{m:"Cb8-b4",e:6.667}],"1#1195892232":[{m:"Rc7xc5",e:5}],"-1#-429371939":[{m:"Rf9-f2",e:5}],"1#385528318":[{m:"Ca3-b3",e:5}],"-1#627357842":[{m:"Rb10-a10",e:5}],"1#488019467":[{m:"Af1-e2",e:5}],"-1#1162837185":[{m:"Ec10-e8",e:5}],"1#1776122914":[{m:"Ri1-h1",e:5}],"-1#1665148690":[{m:"Ch4-g4",e:5}],"1#1918524094":[{m:"Cb3-b2",e:5}],"-1#-945290942":[{m:"Rf2-f6",e:5}],"1#-1636422992":[{m:"Hc3-d5",e:5}],"-1#-1271540595":[{m:"Rf6-f5",e:5}],"1#-417858439":[{m:"Rc7xc5",e:5}],"-1#1178103724":[{m:"Cb4-c4",e:5}],"1#654323429":[{m:"Eg1-e3",e:5}],"-1#-1583798217":[{m:"Hc8-d6",e:5}],"1#-1960082508":[{m:"Rc5-d5",e:5}],"-1#927741483":[{m:"Rf9-f6",e:5}],"1#-2082613621":[{m:"Hg3-h5",e:5}],"-1#-1302429430":[{m:"Rb10-b5",e:5}],"1#-1664695142":[{m:"Rd5-d3",e:5}],"-1#-1760803801":[{m:"Ch4-h3",e:5}],"1#1203500885":[{m:"Hh5-g3",e:5}],"-1#1983422676":[{m:"Rb5-b3",e:5}],"1#-279728903":[{m:"Ri1-h1",e:5}],"-1#1936147423":[{m:"Ch8-h4",e:8.333},{m:"Ri10-i9",e:8.333},{m:"Eg10-e8",e:8.333}],"1#1458469045":[{m:"Hg3-f5",e:7.5},{m:"Eg1-e3",e:7.5},{m:"Ec1-e3",e:7.5}],"-1#1846226":[{m:"Ch4xc4",e:5}],"1#-110816934":[{m:"Hf5-e3",e:5}],"-1#1545069414":[{m:"c6-c5",e:5}],"1#-767702777":[{m:"Ch3-h5",e:5}],"-1#-1570601212":[{m:"c5-b5",e:5}],"1#43494878":[{m:"Rb1xb5",e:5}],"-1#1392032304":[{m:"Cc4xc1+",e:5}],"1#1857403696":[{m:"Ad1-e2",e:5}],"-1#566012464":[{m:"Cb8-a8",e:5}],"1#-390161936":[{m:"Ch5-h8",e:5}],"-1#-797475225":[{m:"Cb8-b4",e:5}],"1#1840920419":[{m:"Ad1-e2",e:5}],"-1#582166115":[{m:"Ch4xc4",e:5}],"1#-607511317":[{m:"Ri1-h1",e:5}],"-1#-782809125":[{m:"Ri10-h10",e:5}],"1#-1961477590":[{m:"Ch3-h7",e:5}],"-1#-14375792":[{m:"Eg10-e8",e:5}],"1#1014601839":[{m:"i4-i5",e:5}],"-1#-2107211761":[{m:"Af10-e9",e:5}],"1#-1899150179":[{m:"Ch7-h8",e:5}],"-1#-285854581":[{m:"Rb10-b6",e:5}],"-1#-469199204":[{m:"Ch4-g4",e:5}],"1#-183309520":[{m:"Ri1-h1",e:5}],"-1#-7360512":[{m:"Ri10-h10",e:5}],"1#-1513173519":[{m:"Rb1-b5",e:5}],"-1#-43974710":[{m:"Cb8-a8",e:5}],"1#878889994":[{m:"Rb5xb10",e:5}],"-1#-506735549":[{m:"Hc8xb10",e:5}],"1#1739493583":[{m:"Ca3xa7",e:5}],"-1#848578768":[{m:"Hb10-c8",e:5}],"1#595876460":[{m:"Ca7-a6",e:5}],"-1#-917184017":[{m:"Rh10-h4",e:5}],"1#852334523":[{m:"Rb1-b7",e:5}],"1#-1338343648":[{m:"Eg1-e3",e:6.667},{m:"Ch3-h5",e:6.667}],"-1#916683250":[{m:"Cb8-b7",e:5}],"1#-416036712":[{m:"Rb1-b5",e:5}],"-1#-1080165725":[{m:"Ch8-h6",e:5}],"1#-2074836575":[{m:"Af1-e2",e:5}],"-1#-603100309":[{m:"Af10-e9",e:5}],"1#-794382343":[{m:"Ri1-f1",e:5}],"-1#-34982093":[{m:"a7-a6",e:5}],"1#-104322511":[{m:"g5-g6",e:5}],"-1#-1681611486":[{m:"g7xg6",e:5}],"1#-793841591":[{m:"c4-c5",e:5}],"-1#532532417":[{m:"Ri10-f10",e:5}],"1#-1771472123":[{m:"Rf1xf10+",e:5}],"-1#-955539816":[{m:"Ae9xf10",e:5}],"1#357130869":[{m:"Hc3-d5",e:5}],"-1#1057659976":[{m:"c6xc5",e:5}],"1#74599900":[{m:"Rb5xc5",e:5}],"-1#975646990":[{m:"Hc8-d6",e:5}],"-1#-1067110109":[{m:"Cb8-b6",e:5}],"1#227442716":[{m:"Eg1-e3",e:5}],"-1#-1961392434":[{m:"g7-g6",e:5}],"1#-28479053":[{m:"Rb1-b5",e:5}],"-1#-1495055480":[{m:"Ch8-h9",e:5}],"1#-24108661":[{m:"Af1-e2",e:5}],"-1#-1496724671":[{m:"Ch9-b9",e:5}],"1#-1495489139":[{m:"Rb5-d5",e:5}],"-1#-1931844657":[{m:"Cb9-g9",e:5}],"1#-237023299":[{m:"Ri1-h1",e:5}],"-1#-79555443":[{m:"g6xg5",e:5}],"1#1636228282":[{m:"Ee3xg5",e:5}],"-1#222743438":[{m:"Ri10-h10",e:5}],"1#1460123263":[{m:"Ch5-h8",e:5}],"-1#860952272":[{m:"Hc8-d6",e:5}],"1#434355539":[{m:"Ch8-i8",e:6.667}],"-1#-1769093008":[{m:"Rh10-i10",e:6.667}],"-1#89036141":[{m:"Cb8-f8",e:8.889},{m:"Hh10-g8",e:8.889},{m:"Eg10-e8",e:8.889},{m:"Hb10-a8",e:8.889},{m:"Ch8-e8",e:8.889},{m:"Cb8-e8",e:8.889}],"1#935334557":[{m:"Hb1-a3",e:5}],"-1#673099461":[{m:"Hb10-c8",e:5}],"1#957267065":[{m:"Ra1-b1",e:5}],"-1#262294661":[{m:"Ra10-a9",e:5}],"1#402380228":[{m:"Hh1-g3",e:5}],"-1#1481013260":[{m:"g7-g6",e:5}],"1#756846449":[{m:"Ch3xh10",e:5}],"-1#143730250":[{m:"Ri10xh10",e:5}],"1#1589360555":[{m:"Eg1-e3",e:5}],"-1#-668814983":[{m:"Ch8-g8",e:5}],"1#-1361469517":[{m:"Af1-e2",e:5}],"-1#-159353479":[{m:"Ec10-e8",e:5}],"1#-636324454":[{m:"Ri1-f1",e:5}],"-1#-144773808":[{m:"Ad10-e9",e:5}],"1#463459745":[{m:"Rf1-f7",e:5}],"-1#-1449039617":[{m:"i7-i6",e:5}],"1#-1504926176":[{m:"Rb1-b7",e:5}],"-1#-2036855421":[{m:"a7-a6",e:5}],"1#-2101735295":[{m:"Rb7xc7",e:5}],"-1#-157994931":[{m:"Rh10-h3",e:5}],"1#1582066737":[{m:"c4-c5",e:5}],"-1#-1856024391":[{m:"Cg8-i8",e:5}],"1#-946328591":[{m:"c5-c6",e:5}],"-1#-1471939251":[{m:"Ra9-a7",e:5}],"1#-892872950":[{m:"Ha3-c4",e:5}],"-1#-268484920":[{m:"Ci8xi4",e:5}],"1#-1417395625":[{m:"Rf7-f1",e:5}],"-1#431685385":[{m:"Cf8-i8",e:5}],"1#-437251135":[{m:"Rf1-h1",e:5}],"-1#-537073846":[{m:"Rh3xh1+",e:5}],"1#1384451833":[{m:"Hg3xh1",e:5}],"-1#1586165154":[{m:"e7-e6",e:5}],"1#-61308715":[{m:"Hh1-g3",e:5}],"-1#-1276826339":[{m:"Ci4-i1",e:5}],"1#-199313897":[{m:"c6-d6",e:5}],"-1#-1220844161":[{m:"Ra7xc7",e:5}],"1#-727744672":[{m:"Cc3xc7",e:5}],"-1#1115314447":[{m:"Hc8-e7",e:5}],"1#1281195291":[{m:"d6xe6",e:5}],"-1#2050950544":[{m:"He7-g8",e:5}],"1#-636131802":[{m:"Cc7-g7",e:5}],"-1#52783137":[{m:"i6-i5",e:5}],"1#-980374276":[{m:"g4-g5",e:5}],"-1#-1990501871":[{m:"g6xg5",e:5}],"1#329224742":[{m:"Ee3xg5",e:5}],"-1#2136966418":[{m:"Hg8-i7",e:5}],"1#1018534053":[{m:"Cg7-b7",e:5}],"-1#-1716961840":[{m:"i5-h5",e:5}],"1#847678122":[{m:"e6-e7",e:5}],"-1#1096626340":[{m:"Hi7-g6",e:5}],"1#1704292852":[{m:"Hg3xh5",e:5}],"-1#905090061":[{m:"Hg6xe7",e:5}],"1#-60009254":[{m:"Cb7-d7",e:5}],"-1#1900382736":[{m:"He7-d5",e:5}],"1#1638326530":[{m:"e4-e5",e:5}],"-1#-433519538":[{m:"Ci1-i4",e:5}],"1#-1580032188":[{m:"Hc4-d6",e:5}],"-1#204330726":[{m:"Hd5-b4",e:5}],"1#860755879":[{m:"Hd6-b7",e:5}],"-1#-1995615330":[{m:"Ci4-e4+",e:5}],"1#-189045292":[{m:"Ke1-f1",e:5}],"-1#1911581229":[{m:"Ci8-i9",e:5}],"1#367580630":[{m:"Eg5-e3",e:5}],"-1#1518297395":[{m:"Ci9-f9",e:5}],"1#852651210":[{m:"Hh5-g7",e:5}],"-1#1994891758":[{m:"Cf9-f8",e:5}],"1#-2045182172":[{m:"Hb7-c9+",e:5}],"-1#1639296571":[{m:"Ke10-d10",e:5}],"1#407046978":[{m:"Cd7-d2",e:5}],"-1#1666035615":[{m:"Hb4-c6",e:5}],"1#1241706068":[{m:"Ee3-c5",e:7.5},{m:"Hc9-d7+",e:7.5}],"-1#-821173468":[{m:"Hc6-e7",e:5}],"-1#836310243":[{m:"Kd10-e10",e:6.667}],"1#-946442720":[{m:"g4-g5",e:5}],"-1#-1956800307":[{m:"Eg10-e8",e:5}],"1#1208001586":[{m:"Ch3-e3",e:5}],"-1#311897558":[{m:"Ri10-h10",e:5}],"1#1222004775":[{m:"Hh1-g3",e:5}],"-1#124517871":[{m:"Ch8-i8",e:5}],"1#982163228":[{m:"Hb1-a3",e:5}],"-1#626271044":[{m:"Hb10-a8",e:6.667}],"1#1875075910":[{m:"Ra1-b1",e:6.667}],"-1#1500484538":[{m:"Ra10-b10",e:6.667}],"1#1629338915":[{m:"Rb1-b5",e:6.667}],"-1#968068888":[{m:"Cb8-d8",e:6.667},{m:"a7-a6",e:6.667}],"1#1425415147":[{m:"Rb5-d5",e:5}],"-1#2129714601":[{m:"Af10-e9",e:5}],"1#1918572859":[{m:"a4-a5",e:5}],"-1#1547025527":[{m:"Rb10-b6",e:5}],"1#791135713":[{m:"Ha3-b5",e:5}],"-1#730070168":[{m:"g7-g6",e:5}],"1#1591282661":[{m:"Cc3-b3",e:5}],"-1#1412507900":[{m:"Rb6-f6",e:5}],"1#1593249657":[{m:"Ce3-c3",e:5}],"-1#615945738":[{m:"a7-a6",e:5}],"1#546605832":[{m:"a5xa6",e:5}],"-1#-1211597593":[{m:"Rf6xa6",e:5}],"1#-2140471787":[{m:"Eg1-e3",e:5}],"-1#116652231":[{m:"Ci8-i9",e:5}],"1#-1489691802":[{m:"g5xg6",e:5}],"-1#-870841488":[{m:"Ra6xg6",e:5}],"1#1598348485":[{m:"Cc3-c2",e:5}],"-1#309868329":[{m:"Rh10-h6",e:5}],"1#-1213231501":[{m:"Cc2-g2",e:5}],"-1#-613253162":[{m:"Rg6-f6",e:5}],"1#1270217476":[{m:"Af1-e2",e:5}],"-1#334238158":[{m:"Rf6-f2",e:5}],"1#-803310507":[{m:"Cb3-b2",e:5}],"-1#1709977513":[{m:"Rf2-f4",e:5}],"1#-136914246":[{m:"Rd5-f5",e:5}],"-1#1276520146":[{m:"Rf4xf5",e:5}],"1#-1187259508":[{m:"Hg3xf5",e:5}],"-1#-505229443":[{m:"Rh6-f6",e:5}],"1#-16191760":[{m:"Hf5-g3",e:5}],"-1#-1443185257":[{m:"Ha8-b6",e:5}],"1#740833368":[{m:"Ri1-h1",e:5}],"1#1032950298":[{m:"Hg3-f5",e:5}],"-1#1801699709":[{m:"Rh10-h6",e:5}],"1#-827033561":[{m:"Rb5-d5",e:5}],"-1#-458047899":[{m:"Ha8-b6",e:5}],"1#1633696682":[{m:"Rd5-d6",e:5}],"-1#-448872190":[{m:"Rh6xd6",e:5}],"1#-132302547":[{m:"Hf5xd6",e:5}],"-1#64715564":[{m:"Rb10-b9",e:5}],"1#1552737520":[{m:"Ri1-h1",e:5}],"-1#1444003776":[{m:"Rb9-d9",e:5}],"1#1528872214":[{m:"Hd6-f5",e:5}],"-1#-1253512520":[{m:"Hb6-d5",e:5}],"1#1977184975":[{m:"Cc3-c2",e:5}],"-1#-1421171697":[{m:"Rd9-f9",e:5}],"1#504464979":[{m:"Hf5xg7",e:5}],"-1#1559435416":[{m:"Ci8xi4",e:5}],"1#411591687":[{m:"Af1-e2",e:5}],"-1#1087475405":[{m:"Rf9-f7",e:5}],"1#239579662":[{m:"g5-g6",e:5}],"-1#1816870173":[{m:"Hd5-f4",e:5}],"1#-103873576":[{m:"Ce3-g3",e:5}],"-1#-1602510485":[{m:"Ci4xe4+",e:5}],"1#549092195":[{m:"Eg1-e3",e:5}],"-1#-1507623503":[{m:"Hf4xg6",e:5}],"1#-629361375":[{m:"Rh1-f1",e:5}],"-1#-529514070":[{m:"Rf7xf1+",e:5}],"1#970482035":[{m:"Ke1xf1",e:5}],"-1#-863122647":[{m:"c7-c6",e:5}],"1#267005970":[{m:"Cg3-g5",e:5}],"-1#577114044":[{m:"Ce4xa4",e:5}],"1#-971789934":[{m:"Ch3-e3",e:5}],"-1#-1669062538":[{m:"Hh10-g8",e:5}],"1#1583143739":[{m:"Hh1-g3",e:5}],"-1#299988723":[{m:"Ri10-h10",e:5}],"1#1268779778":[{m:"Ri1-i2",e:5}],"-1#518276970":[{m:"Hb10-a8",e:5}],"1#1416824680":[{m:"Hb1-a3",e:5}],"-1#1269676848":[{m:"Ra10-b10",e:5}],"1#1944032681":[{m:"Ra1-b1",e:5}],"-1#1165190485":[{m:"g7-g6",e:5}],"1#808030760":[{m:"a4-a5",e:8.571},{m:"Rb1-b5",e:8.571}],"-1#507983716":[{m:"Af10-e9",e:8.333},{m:"Ch8-i8",e:8.333}],"1#317518838":[{m:"Ri2-f2",e:8}],"-1#507066764":[{m:"Ch8-h6",e:8},{m:"Ch8-i8",e:8}],"1#636502670":[{m:"Rf2-f5",e:7.5},{m:"Rf2-f7",e:7.5},{m:"Rb1-b5",e:7.5}],"-1#-639513048":[{m:"a7-a6",e:5}],"-1#-19999111":[{m:"a7-a6",e:5}],"-1#2103341237":[{m:"a7-a6",e:5}],"1#601381759":[{m:"Rb1-b5",e:5}],"-1#2071357764":[{m:"Rh10-h4",e:5}],"1#-1086880237":[{m:"g4-g5",e:5}],"-1#-201559810":[{m:"Rh4-g4",e:5}],"1#539706853":[{m:"Rf2-f5",e:5}],"-1#-600127165":[{m:"Cb8-d8",e:5}],"1#598103447":[{m:"Rb1-b5",e:5}],"-1#2064148396":[{m:"Rh10-h4",e:5}],"1#-1085699845":[{m:"Ce3-d3",e:5}],"-1#2067866550":[{m:"Rh4xg4",e:5}],"1#450230705":[{m:"Ec1-e3",e:5}],"-1#-1473046632":[{m:"Rg4-f4",e:5}],"1#-1034170287":[{m:"Cd3-d8",e:5}],"-1#1488130240":[{m:"Cb8-c8",e:5}],"1#-733128030":[{m:"Cd8xa8",e:5}],"-1#2032157562":[{m:"Rb10xb5",e:5}],"1#1341786460":[{m:"Ha3xb5",e:5}],"-1#1062745210":[{m:"Ec10xa8",e:5}],"1#-165721704":[{m:"Hb5-d6",e:5}],"-1#2055000193":[{m:"Cc8-d8",e:5}],"-1#1753718803":[{m:"Cb8-d8",e:7.5}],"1#96613600":[{m:"Ri2-b2",e:7.5},{m:"a4-a5",e:7.5},{m:"Rb5xb10",e:7.5}],"-1#-48523381":[{m:"Rb10xb5",e:5}],"1#-876487251":[{m:"Rb2xb5",e:5}],"-1#700504678":[{m:"a7-a6",e:5}],"1#769836900":[{m:"g4-g5",e:5}],"-1#1630089609":[{m:"g6xg5",e:5}],"1#-68290114":[{m:"Rb5xg5",e:5}],"-1#284560293":[{m:"Ch8-h9",e:5}],"1#1216702886":[{m:"Rg5-h5",e:5}],"-1#1020802578":[{m:"Ha8-b6",e:6.667}],"-1#732729772":[{m:"Af10-e9",e:5}],"1#654791998":[{m:"Ri2-f2",e:5}],"-1#735223620":[{m:"Rb10xb5",e:5}],"1#487118178":[{m:"Ha3xb5",e:5}],"-1#1839917124":[{m:"Rh10-f10",e:5}],"1#-1545464576":[{m:"Rf2xf10+",e:5}],"-1#-1686054604":[{m:"Ke10xf10",e:5}],"1#941737401":[{m:"Cc3-a3",e:5}],"-1#478861501":[{m:"Cd8-d7",e:5}],"-1#-798282583":[{m:"Ha8xb10",e:5}],"1#227097243":[{m:"Ri2-b2",e:5}],"-1#-179267088":[{m:"Hb10-a8",e:5}],"1#-1077421582":[{m:"a4-a5",e:5}],"-1#-1851163458":[{m:"Af10-e9",e:5}],"1#-1660766164":[{m:"Rb2-b8",e:5}],"-1#-1544740401":[{m:"Rh10-f10",e:5}],"1#1839586443":[{m:"Ad1-e2",e:5}],"-1#581750155":[{m:"c7-c6",e:5}],"1#1339676015":[{m:"a4-a5",e:5}],"-1#1639411747":[{m:"Ra10-b10",e:5}],"1#1506107066":[{m:"Hb1-a3",e:5}],"-1#1176232674":[{m:"Ch8-e8",e:5}],"1#628265945":[{m:"Hh1-g3",e:5}],"-1#1791966737":[{m:"Hh10-g8",e:5}],"1#-1474837156":[{m:"Ri1-h1",e:5}],"-1#-1567973780":[{m:"Ri10-h10",e:5}],"1#-120855651":[{m:"Ra1-b1",e:5}],"-1#-832105631":[{m:"Cb8-b3",e:5}],"1#-524471383":[{m:"Eg1-e3",e:5}],"-1#1713649019":[{m:"g7-g6",e:5}],"1#327074310":[{m:"Ch3-h5",e:5}],"-1#1663142917":[{m:"Cb3-b4",e:5}],"1#-303312200":[{m:"Af1-e2",e:5}],"-1#-1246611342":[{m:"Hg8-f6",e:5}],"1#398716097":[{m:"Ch5-b5",e:5}],"-1#617792234":[{m:"Rh10xh1+",e:5}],"1#481247316":[{m:"Hg3xh1",e:5}],"-1#278969103":[{m:"Cb4xe4",e:5}],"1#-626484206":[{m:"Cc3-b3",e:5}],"-1#-801063157":[{m:"Rb10-a10",e:5}],"1#-399339118":[{m:"Hh1-g3",e:5}],"-1#-1483785126":[{m:"Ce4-e5",e:5}],"1#858422405":[{m:"c4-c5",e:5}],"-1#-63356915":[{m:"Ra10-a9",e:5}],"1#-463414964":[{m:"Cb3-c3",e:5}],"-1#-293012907":[{m:"Ra9-d9",e:5}],"1#-2129074186":[{m:"c5-c6",e:5}],"-1#-289197750":[{m:"Hf6-d5",e:5}],"1#-1336870265":[{m:"Cc3-c2",e:5}],"-1#1858284615":[{m:"Ce5xb5",e:5}],"1#-289653657":[{m:"Rb1xb5",e:5}],"-1#1260356835":[{m:"c7xc6",e:5}],"1#-646883249":[{m:"Cc2xc10+",e:5}],"-1#626463484":[{m:"Ke10-e9",e:5}],"1#81471833":[{m:"Ke1-f1",e:5}],"-1#-2121259360":[{m:"Ce8-f8",e:5}],"1#1010645699":[{m:"Kf1-e1",e:5}],"-1#-1183435462":[{m:"c6-c5",e:5}],"1#928784219":[{m:"Rb5xc5",e:5}],"-1#151610249":[{m:"Ha8-c7",e:5}],"1#206288880":[{m:"Ha3-b5",e:5}],"-1#149917321":[{m:"Hc7xb5",e:5}],"1#-98156755":[{m:"Rc5xb5",e:5}],"-1#379734370":[{m:"Cf8-f5",e:5}],"1#1986997629":[{m:"Cc10-c9+",e:5}],"-1#1114140805":[{m:"Rd9-d8",e:5}],"1#1481036722":[{m:"Rb5-b9",e:5}],"-1#944695037":[{m:"Ke9-e10",e:5}],"1#432201048":[{m:"Cc9-c10+",e:5}],"-1#767918240":[{m:"Ad10-e9",e:5}],"1#-1056655279":[{m:"Cc10-a10",e:5}],"-1#-640979966":[{m:"Ke10-d10",e:5}],"1#-1606563461":[{m:"Rb9-b10+",e:5}],"-1#1325573554":[{m:"Kd10-d9",e:5}],"1#1764476817":[{m:"Hg3-h1",e:5}],"-1#647391833":[{m:"Hd5-f4",e:6.667},{m:"Cf5-e5",e:6.667}],"1#-1837973422":[{m:"Rb10-b4",e:5}],"-1#139521988":[{m:"Rd8xd1+",e:5}],"1#-430364512":[{m:"Ae2xd1",e:5}],"-1#98779628":[{m:"Hf4-d3+",e:5}],"1#-1391270433":[{m:"Ke1-f1",e:5}],"-1#676981286":[{m:"Hd3xb4",e:5}],"1#-1602929302":[{m:"Ca10xg10",e:5}],"-1#1995529543":[{m:"Hb4-d5",e:5}],"1#-230503708":[{m:"Hh1-g3",e:5}],"-1#-1107335380":[{m:"Cf5xa5",e:5}],"1#-2068309618":[{m:"Ke1-f1",e:6.667}],"-1#32708215":[{m:"Rd8-f8+",e:6.667},{m:"Ce5-f5",e:6.667}],"1#-1293900892":[{m:"Kf1-e1",e:5}],"-1#933997661":[{m:"Cf5-e5",e:6.667}],"1#-1545771616":[{m:"Hg3-h1",e:5}],"1#1713890390":[{m:"Ch3-e3",e:7.5},{m:"Hh1-g3",e:7.5}],"-1#1018195378":[{m:"Hh10-g8",e:5}],"1#-26700033":[{m:"Hh1-g3",e:5}],"-1#-1311425737":[{m:"Ri10-h10",e:5}],"1#-342604090":[{m:"Hb1-a3",e:5}],"-1#697977246":[{m:"Hh10-g8",e:6.667}],"1#-347950381":[{m:"Ri1-h1",e:6.667}],"-1#-505419293":[{m:"Ri10-h10",e:6.667}],"1#-1147235310":[{m:"Eg1-e3",e:6.667},{m:"Hb1-a3",e:6.667}],"-1#1023906496":[{m:"Hb10-a8",e:5}],"1#2005979842":[{m:"Hb1-a3",e:5}],"-1#1749970586":[{m:"Ra10-b10",e:5}],"1#1346125827":[{m:"Ra1-a2",e:5}],"-1#-646068056":[{m:"Cb8-d8",e:5}],"1#-1271374757":[{m:"Ra2-d2",e:5}],"-1#1614585441":[{m:"Ad10-e9",e:5}],"1#-1929533808":[{m:"Rd2-d5",e:5}],"-1#-1782781820":[{m:"Rh10-h6",e:5}],"1#812339678":[{m:"a4-a5",e:5}],"-1#503706770":[{m:"g7-g6",e:5}],"1#1801389039":[{m:"Af1-e2",e:5}],"-1#856090917":[{m:"Hg8-f6",e:5}],"1#-1854456426":[{m:"Rd5-d6",e:5}],"-1#355059518":[{m:"Hf6xg4",e:5}],"1#-141047729":[{m:"Ch3-i3",e:5}],"-1#-1539299254":[{m:"Hb10-a8",e:5}],"1#-287872952":[{m:"Ra1-b1",e:5}],"-1#-662988620":[{m:"Ra10-b10",e:5}],"1#-536234451":[{m:"g4-g5",e:5}],"-1#-1396555584":[{m:"Rh10-h4",e:5}],"1#1753460631":[{m:"Eg1-e3",e:5}],"-1#-300242619":[{m:"Cb8-b4",e:5}],"1#1406656577":[{m:"c4-c5",e:5}],"-1#-1664820023":[{m:"Ce8-c8",e:5}],"1#452000825":[{m:"Ch3-i3",e:5}],"-1#1833644838":[{m:"Rh4xh1",e:5}],"1#-1934988866":[{m:"Hg3xh1",e:5}],"-1#-2136632603":[{m:"Ec10-e8",e:5}],"1#-1405644282":[{m:"Hh1-g3",e:5}],"-1#-477478962":[{m:"g7-g6",e:5}],"1#820421317":[{m:"Ch3-e3",e:5}],"-1#1785801505":[{m:"Ce8xe4+",e:5}],"1#672952976":[{m:"Af1-e2",e:5}],"-1#1883609178":[{m:"Hb10-c8",e:5}],"1#1632996070":[{m:"Hh1-g3",e:5}],"-1#786966318":[{m:"Ce4-e6",e:5}],"1#1764734613":[{m:"Ri1-h1",e:5}],"-1#1672670629":[{m:"Ch8-g8",e:5}],"1#357155695":[{m:"Hb1-a3",e:5}],"-1#177700663":[{m:"Eg10-e8",e:5}],"1#-909491256":[{m:"Rh1-h9",e:5}],"-1#-544933770":[{m:"Ra10-a9",e:5}],"1#-941792969":[{m:"Rh9xa9",e:5}],"-1#629943815":[{m:"Hc8xa9",e:5}],"1#1942063864":[{m:"Ra1-b1",e:5}],"-1#1164802564":[{m:"Ha9-c8",e:5}],"1#-49975351":[{m:"Hg3-e4",e:5}],"-1#511236822":[{m:"Hh10-f9",e:5}],"1#-384190507":[{m:"Ce3xe6",e:5}],"-1#-1345126567":[{m:"e7xe6",e:5}],"1#-505456668":[{m:"He4-c5",e:5}],"-1#1127450911":[{m:"Hf9-d8",e:5}],"1#-2100052307":[{m:"Hc5-d7",e:5}],"-1#1459332346":[{m:"Ri10-i9",e:5}],"1#391213214":[{m:"Rb1-b8",e:5}],"-1#1056790052":[{m:"Af10-e9",e:5}],"1#844534454":[{m:"Rb8xc8",e:5}],"-1#-1970980233":[{m:"Cg8xg4",e:5}],"1#2058272103":[{m:"Cc3-f3",e:5}],"-1#150333024":[{m:"Cg4-e4+",e:5}],"1#2137480263":[{m:"Ec1-e3",e:5}],"-1#-847138194":[{m:"Ri9-f9",e:5}],"1#-641309812":[{m:"Cf3-f1",e:5}],"-1#-126284082":[{m:"i7-i6",e:5}],"1#-141246447":[{m:"Hd7-c5",e:5}],"-1#599579206":[{m:"e6-e5",e:5}],"1#-813900046":[{m:"Hc5-b7",e:5}],"-1#-2037338020":[{m:"Rf9-h9",e:5}],"1#-1849488304":[{m:"Hb7-c9+",e:5}],"-1#1317115160":[{m:"Ke10-f10",e:5}],"1#868856298":[{m:"Rc8xc7",e:5}],"-1#-172266742":[{m:"Ee8-g6",e:5}],"1#-1674542525":[{m:"Rc7-f7+",e:5}],"-1#-1147491857":[{m:"Hd8-f9",e:5}],"1#2054856285":[{m:"Rf7-f4",e:5}],"-1#-1742952157":[{m:"Ce4xa4",e:5}],"1#1098270244":[{m:"c4-c5",e:5}],"-1#-1905952084":[{m:"Ca4-a6",e:5}],"1#-2118425220":[{m:"Rf4-f6",e:5}],"-1#-879173181":[{m:"Ca6-a4",e:5}],"1#-1001980397":[{m:"Cf1-f4",e:5}],"-1#1081531663":[{m:"Ca4xi4",e:5}],"1#388028074":[{m:"Ke1-f1",e:5}],"-1#-1838425773":[{m:"Rh9-h2",e:5}],"1#-1131548611":[{m:"Kf1-e1",e:5}],"-1#969342916":[{m:"Ci4-i1+",e:5}],"1#2117952718":[{m:"Ae2-f1",e:5}],"-1#644124164":[{m:"Rh2-f2",e:5}],"1#-280762555":[{m:"Ad1-e2",e:5}],"-1#-1605700027":[{m:"e5-e4",e:5}],"1#457646788":[{m:"Ha3-c4",e:5}],"-1#1048562438":[{m:"Rf2xf4",e:5}],"1#828017224":[{m:"Rf6xf4",e:5}],"-1#1721221":[{m:"e4xf4",e:5}],"1#1959237067":[{m:"Hc4-e5",e:5}],"-1#130691531":[],"-1#1576983865":[{m:"Hh10-g8",e:9.995},{m:"Cb8-c8",e:9.995},{m:"Ch8-c8",e:9.995},{m:"Ec10-e8",e:9.995},{m:"c7-c6",e:9.995},{m:"Ch8-d8",e:9.995},{m:"g7-g6",e:9.995},{m:"Hh10-i8",e:9.995},{m:"Hb10-c8",e:9.995},{m:"Cb8-f8",e:9.995},{m:"Hb10-a8",e:9.995},{m:"Cb8-e8",e:9.995},{m:"Ch8-f8",e:9.995},{m:"Ch8-e8",e:9.995}],"1#-1624889740":[{m:"g4-g5",e:9.885},{m:"Ra1-a2",e:9.885},{m:"c4-c5",e:9.885},{m:"Cb3-a3",e:9.885},{m:"Hh1-g3",e:9.885},{m:"Hb1-c3",e:9.999}],"-1#-739389287":[{m:"Ch8-i8",e:9.714},{m:"c7-c6",e:9.714}],"1#-301157782":[{m:"Ch3-f3",e:7.5},{m:"Hh1-g3",e:7.5}],"1#277490594":[{m:"Ch3-f3",e:9.722},{m:"Cb3-a3",e:9.722}],"-1#375893727":[{m:"Hb10-c8",e:5}],"1#125287523":[{m:"Ra2-d2",e:5}],"-1#-747405735":[{m:"Ra10-a9",e:5}],"1#-886380776":[{m:"Ch3-e3",e:5}],"-1#-1849856260":[{m:"Ri10-h10",e:5}],"1#-872672499":[{m:"e4-e5",e:5}],"-1#-1397215464":[{m:"Hb10-c8",e:8},{m:"Cb8-e8",e:8}],"1#-1113047644":[{m:"Ra1-b1",e:7.5}],"1#-1726998352":[{m:"Ra1-b1",e:5}],"-1#-1346574260":[{m:"Hb10-c8",e:5}],"-1#-795112516":[{m:"Ec10-e8",e:5}],"1#-66483361":[{m:"Ra1-a2",e:5}],"-1#1967653876":[{m:"Hb10-a8",e:5}],"1#1071596534":[{m:"Ra2-f2",e:5}],"-1#-1912747302":[{m:"Ri10-i9",e:5}],"-1#-978210928":[{m:"Ri10-h10",e:9.231},{m:"Hh10-g8",e:8.333},{m:"Ri10-i9",e:9.231},{m:"c7-c6",e:9.231}],"1#-1611607455":[{m:"Hh1-g3",e:8.889}],"1#-788490405":[{m:"Hh1-g3",e:7.5},{m:"g4-g5",e:7.5}],"-1#-1631765869":[{m:"Hh10-g8",e:5}],"1#1550172638":[{m:"Ra1-b1",e:5}],"-1#1791570210":[{m:"g7-g6",e:5}],"1#529778271":[{m:"c4-c5",e:5}],"-1#-796853545":[{m:"Ec10-e8",e:5}],"1#-65865164":[{m:"Cb3-a3",e:5}],"-1#-812846248":[{m:"Ri10-i9",e:6.667},{m:"Hb10-d9",e:6.667}],"1#-1910102212":[{m:"Ri1-i2",e:7.5}],"-1#-614306988":[{m:"Cc8xc5",e:7.5},{m:"Hg8-h6",e:7.5}],"1#-978416574":[{m:"Rb1-b9",e:5}],"-1#-522863545":[{m:"Hd9-f8",e:5}],"1#905471078":[{m:"Hc3-d5",e:5}],"-1#532388443":[{m:"Hf8-e6",e:5}],"-1#-1647615562":[{m:"Hb10-a8",e:6.667},{m:"c7-c6",e:6.667}],"1#-681827916":[{m:"Ch3-f3",e:5}],"-1#-234850547":[{m:"Ra10-b10",e:5}],"1#-898475628":[{m:"Ra1-b1",e:5}],"-1#-52516504":[{m:"Rb10-b6",e:5}],"1#-1882402562":[{m:"Hh1-g3",e:5}],"-1#-1066304202":[{m:"Ch8-e8",e:5}],"1#1588370061":[{m:"Hh1-g3",e:5}],"-1#286340933":[{m:"Eg10-e8",e:5}],"1#-766768198":[{m:"Ra1-b1",e:5}],"-1#-455017658":[{m:"Hb10-a8",e:5}],"1#-1367884988":[{m:"Cb3-a3",e:5}],"-1#-1645628888":[{m:"Hh10-f9",e:5}],"1#-1518421117":[{m:"g4-g5",e:6.667},{m:"Cb3-a3",e:6.667}],"-1#-373994130":[{m:"Hh10-g8",e:5}],"1#728610339":[{m:"Hh1-g3",e:5}],"-1#1691360235":[{m:"Ri10-h10",e:5}],"1#1049716250":[{m:"Ri1-h1",e:5}],"-1#873217322":[{m:"c7-c6",e:5}],"1#-143931887":[{m:"Cb3-b5",e:6.667},{m:"Cb3-a3",e:6.667}],"-1#-1071475025":[{m:"Rh10-h4",e:5}],"1#73628152":[{m:"Hg3-f5",e:5}],"-1#1385245343":[{m:"c6-c5",e:5}],"1#-591724290":[{m:"Cb5-a5",e:5}],"-1#-990523523":[{m:"Ec10-e8",e:5}],"1#-395849826":[{m:"Ra1-b1",e:5}],"-1#-557105310":[{m:"Hb10-d9",e:5}],"1#-722911112":[{m:"Ec1-e3",e:5}],"-1#-1763659025":[{m:"Ec10-e8",e:5}],"1#-1166888436":[{m:"Ra1-b1",e:5}],"-1#-1931590928":[{m:"Hb10-d9",e:5}],"1#-2030289430":[{m:"Ri1-i2",e:5}],"-1#-742887038":[{m:"Cb8-b10",e:5}],"1#-952192184":[{m:"Ri2-d2",e:5}],"-1#1762860971":[{m:"Cc8-b8",e:5}],"1#87880629":[{m:"Rb1-a1",e:5}],"-1#865076041":[{m:"Ra10-a9",e:5}],"1#734632456":[{m:"Ra1-a2",e:5}],"-1#-1568140637":[{m:"Ad10-e9",e:5}],"1#1313417810":[{m:"Ch3-h9",e:5}],"-1#-543842149":[{m:"Ri10-i9",e:5}],"1#-1640008449":[{m:"Ch9xd9",e:5}],"-1#-1726991072":[{m:"Ae9-d8",e:5}],"1#1902960090":[{m:"Cb3-a3",e:8},{m:"Ch3-e3",e:8}],"-1#1123210422":[{m:"Hb10-c8",e:7.5}],"1#1407370762":[{m:"Ra1-b1",e:7.5}],"-1#1699624694":[{m:"Ra10-b10",e:7.5},{m:"Cb8-a8",e:7.5}],"1#1564219503":[{m:"c4-c5",e:6.667}],"-1#-1842404121":[{m:"g7-g6",e:6.667},{m:"Hh10-g8",e:6.667}],"1#-411708518":[{m:"Rb1-b7",e:9.919}],"1#1358421930":[{m:"g4-g5",e:5}],"1#-1404304074":[{m:"c4-c5",e:5}],"-1#1667185086":[{m:"Ad10-e9",e:5}],"1#-1885470385":[{m:"g4-g5",e:5}],"-1#-1017776222":[{m:"Hh10-i8",e:5}],"1#1261355102":[{m:"Hh1-g3",e:5}],"-1#737891390":[{m:"Hh10-g8",e:5}],"1#-383537293":[{m:"Hh1-g3",e:5}],"-1#-1499594053":[{m:"Ri10-h10",e:5}],"1#-52461750":[{m:"c4-c5",e:6.667},{m:"g4-g5",e:6.667}],"-1#869024706":[{m:"c7-c6",e:9.474},{m:"Ch8-i8",e:9.474},{m:"Cb8-c8",e:9.474},{m:"g7-g6",e:9.474},{m:"Hb10-d9",e:9.474}],"-1#-1340831321":[{m:"Ch8-i8",e:6.667}],"1#-1913263276":[{m:"Ra1-a2",e:9.5},{m:"Cb3-a3",e:9.5},{m:"c4-c5",e:9.5}],"-1#-1100225992":[{m:"Rh10-h6",e:9.231}],"1#-1634130430":[{m:"Ch3-e3",e:9.994},{m:"g4-g5",e:9.994},{m:"Hh1-g3",e:9.994},{m:"Ch3-f3",e:9.994},{m:"Ra1-a2",e:9.994},{m:"Cb3-b5",e:9.994},{m:"Hb1-c3",e:9.412},{m:"Cb3-a3",e:9.994},{m:"i4-i5",e:9.994}],"-1#-1005670426":[{m:"Ch8-e8",e:9.974},{m:"Ec10-e8",e:9.974},{m:"c7-c6",e:9.231}],"-1#-766324497":[{m:"c7-c6",e:9.714}],"-1#-786134070":[{m:"g7-g6",e:8.75},{m:"c7-c6",e:7.5}],"1#-1535214409":[{m:"Cb3-a3",e:7.5}],"1#-1070294666":[{m:"Ri1-i2",e:8.75},{m:"Ch3-i3",e:8.75}],"-1#-1144688453":[{m:"g7-g6",e:9.96},{m:"Hh10-g8",e:9.96},{m:"Ch8-d8",e:9.96}],"-1#400076457":[{m:"Hb10-c8",e:9},{m:"Cb8-c8",e:9},{m:"Ch8-c8",e:9}],"-1#-1445955908":[{m:"Hb10-c8",e:5}],"1#-1195351040":[{m:"Cb5-i5",e:5}],"-1#1060692266":[{m:"Hh10-i8",e:5}],"-1#-2028526020":[{m:"Hb10-c8",e:8.75},{m:"Ch8-e8",e:8.75},{m:"c7-c6",e:5}],"1#-1777912704":[{m:"Ec1-e3",e:8.333},{m:"Ri1-i2",e:8.333},{m:"i4-i5",e:8.333}],"-1#618781353":[{m:"Ch8-e8",e:5}],"-1#-1018988312":[{m:"Hb10-c8",e:5}],"1#-860965321":[{m:"Ri2-d2",e:6.667}],"-1#1652759252":[{m:"Hh10-i8",e:6.667}],"1#-352834264":[{m:"Rd2-d5",e:6.667}],"-1#-1863123558":[{m:"Ec10-e8",e:6.667},{m:"Ri10-i9",e:6.667}],"1#-1134494343":[{m:"Ec1-e3",e:5}],"-1#243667792":[{m:"Ch8-f8",e:5}],"1#-845198983":[{m:"Ad1-e2",e:5}],"-1#-2104076167":[{m:"Ri10-h10",e:5}],"1#-782751234":[{m:"Ad1-e2",e:6.667},{m:"i6-i7",e:6.667}],"-1#2029818924":[{m:"Ca6-a7",e:5}],"-1#672672992":[{m:"Hh10-g8",e:5}],"1#-461482233":[{m:"Ri1-h1",e:5}],"-1#-287110089":[{m:"Hh10-g8",e:5}],"1#742127482":[{m:"i4-i5",e:5}],"-1#-1843073254":[{m:"Hb10-c8",e:5}],"1#-2093679194":[{m:"Cb3-b5",e:5}],"1#1171250545":[{m:"Ri1-i2",e:6.667}],"-1#277582105":[{m:"Hb10-c8",e:6.667}],"1#26968997":[{m:"Ri2-d2",e:7.5}],"-1#-1347014842":[{m:"i7-i6",e:7.5},{m:"g7-g6",e:7.5}],"1#-1604591207":[{m:"Rd2-d5",e:6.667}],"-1#-632213205":[{m:"Ch8-i8",e:6.667}],"1#-407874600":[{m:"c4-c5",e:6.667},{m:"Ch3-f3",e:6.667}],"-1#681799504":[{m:"c6xc5",e:5}],"-1#-1024719519":[{m:"Ri10-h10",e:5}],"1#-1733461872":[{m:"Ad1-e2",e:5}],"1#-622012357":[{m:"Rd2-d9",e:5}],"-1#-867300752":[{m:"Af10-e9",e:5}],"1#-1058681118":[{m:"Ec1-e3",e:5}],"-1#1912807627":[{m:"Ch8-h9",e:5}],"1#712000200":[{m:"Rd9-d5",e:5}],"-1#1527084864":[{m:"Hg8-f6",e:5}],"1#-109796365":[{m:"Rd5-f5",e:5}],"-1#-1392038034":[{m:"Hb10-c8",e:9.932},{m:"Hb10-a8",e:9.932},{m:"Cb8-g8",e:9.932}],"-1#545668706":[{m:"Hh10-g8",e:5}],"1#-497105617":[{m:"Ra1-a2",e:5}],"-1#1797213572":[{m:"Cb8-e8",e:5}],"1#1242395892":[{m:"c4-c5",e:8.333},{m:"Ch3-e3",e:8.333},{m:"Cb3-a3",e:8.333}],"-1#278592784":[{m:"Hh10-g8",e:7.5}],"1#-767424931":[{m:"Hh1-g3",e:7.5}],"-1#-1644188779":[{m:"Ri10-h10",e:7.5},{m:"Eg10-e8",e:7.5}],"1#-943794588":[{m:"Ri1-i2",e:6.667}],"-1#-1829070324":[{m:"Rh10-h6",e:6.667},{m:"Hb10-c8",e:6.667}],"1#1587713898":[{m:"c4-c5",e:5}],"-1#-1850627102":[{m:"Af10-e9",e:5}],"1#-1659211920":[{m:"Ri1-h1",e:6.667}],"-1#2039709080":[{m:"Hh10-g8",e:5}],"1#-1152678187":[{m:"Ra1-b1",e:5}],"-1#-1914210775":[{m:"Cb8-c8",e:5}],"1#18431051":[{m:"Hh1-g3",e:5}],"-1#1319408003":[{m:"Hb10-a8",e:5}],"1#70504833":[{m:"g4-g5",e:5}],"-1#1224222572":[{m:"Ri10-h10",e:5}],"1#314137245":[{m:"Hg3-f5",e:5}],"-1#1145768442":[{m:"Ra10-b10",e:5}],"1#2084120419":[{m:"Rb1xb10",e:5}],"1#681847364":[{m:"c4-c5",e:9.924},{m:"Ch3-f3",e:9.924},{m:"Ch3-e3",e:9.924},{m:"Ra1-a2",e:9.924},{m:"Ch3-g3",e:9.924},{m:"Cb3-a3",e:9.924},{m:"Eg1-e3",e:9.924}],"-1#234388733":[{m:"Hh10-g8",e:8},{m:"g7-g6",e:9.96},{m:"Ch8-f8",e:8}],"1#-819951696":[{m:"Cb3-a3",e:5}],"1#-824105260":[{m:"Hh1-i3",e:5}],"-1#1915986848":[{m:"Hb10-c8",e:9.286},{m:"Hh10-g8",e:9.286}],"1#1663283484":[{m:"Hh1-g3",e:8}],"1#-1326753555":[{m:"Hh1-g3",e:9.091}],"-1#-1578786065":[{m:"Hh10-g8",e:8.571},{m:"Eg10-e8",e:8.571},{m:"Ec10-e8",e:8.571}],"1#1664965026":[{m:"Eg1-e3",e:6.667}],"1#1656266256":[{m:"g4-g5",e:6.667}],"-1#911881826":[{m:"Hh10-i8",e:9.412},{m:"Eg10-e8",e:9.412},{m:"Ec10-e8",e:9.412}],"1#-1105133154":[{m:"Hh1-i3",e:6.667}],"1#449328769":[{m:"Hh1-i3",e:8.333}],"-1#456794920":[{m:"Cb8-e8",e:8.75},{m:"Hb10-c8",e:8.75},{m:"Cb8-d8",e:8.75}],"1#1988081627":[{m:"Ra1-b1",e:5}],"-1#-1371722602":[{m:"Hh10-g8",e:9.949},{m:"Ch8-f8",e:9.949},{m:"c7-c6",e:9.949},{m:"Hb10-c8",e:9.949}],"1#-712643899":[{m:"c4-c5",e:5}],"-1#446092877":[{m:"Ri10-i9",e:5}],"1#1530659369":[{m:"Hh1-g3",e:5}],"-1#344043489":[{m:"Ec10-e8",e:5}],"1#940814082":[{m:"Ri1-i2",e:8.333},{m:"Ch3-i3",e:8.333},{m:"Ec1-e3",e:8.333}],"-1#1834476394":[{m:"Ri9-d9",e:5}],"1#-1840035115":[{m:"g4-g5",e:5}],"-1#-560415688":[{m:"Hb10-c8",e:5}],"1#-813126012":[{m:"Hg3-h5",e:6.667},{m:"Ec1-e3",e:6.667}],"-1#-32769787":[{m:"Ch8-f8",e:5}],"1#1024631596":[{m:"Ri2-f2",e:5}],"-1#2104377517":[{m:"Ra10-c10",e:6.667}],"-1#1336434717":[{m:"Ri9-d9",e:7.5},{m:"Ri9-c9",e:7.5}],"1#-1330853470":[{m:"Ri1-h1",e:6.667}],"-1#-1171156334":[{m:"Rd9-d6",e:6.667}],"1#1345380497":[{m:"g4-g5",e:6.667}],"1#523090518":[{m:"Hc3-d5",e:5}],"-1#896418923":[{m:"c7-c6",e:5}],"1#-167133360":[{m:"c5xc6",e:5}],"-1#-1963638485":[{m:"c7-c6",e:5}],"1#1234352656":[{m:"c5xc6",e:5}],"-1#1979826628":[{m:"Ri9-c9",e:5}],"1#646192015":[{m:"Hc3-d5",e:5}],"-1#214427058":[{m:"Rc9xc6",e:5}],"1#1160304816":[{m:"g4-g5",e:5}],"-1#165883485":[{m:"Rc6-d6",e:5}],"1#1230504526":[{m:"Ch3-h5",e:5}],"1#1290719109":[{m:"c4-c5",e:7.5},{m:"Hb1-c3",e:9.942}],"-1#2439528":[{m:"c7-c6",e:7.5},{m:"Ra10-a9",e:7.5},{m:"Eg10-e8",e:7.5}],"1#-1019035053":[{m:"Hh1-g3",e:9.986},{m:"Ch3-e3",e:9.986},{m:"Ra1-a2",e:9.986},{m:"g4-g5",e:5}],"-1#1906584698":[{m:"Hb10-c8",e:5}],"1#1563831449":[{m:"Hh1-g3",e:6.667}],"-1#311132497":[{m:"c7-c6",e:5}],"1#410820649":[{m:"Cb3-a3",e:5}],"-1#736274757":[{m:"Eg10-e8",e:5}],"1#-390097478":[{m:"Ra1-b1",e:5}],"-1#-569154234":[{m:"Cb8-a8",e:5}],"1#387012230":[{m:"Rb1-b5",e:5}],"1#-1015544425":[{m:"Ch3-e3",e:5}],"-1#-1712354189":[{m:"Ch8-f8",e:5}],"1#1526126170":[{m:"Ri1-i3",e:5}],"-1#-14080922":[{m:"Hh10-g8",e:5}],"1#1039261483":[{m:"Ri3-f3",e:5}],"1#1869634249":[{m:"Ra1-b1",e:7.5},{m:"Hb1-c3",e:9.545}],"-1#1507633717":[{m:"Hb10-c8",e:6.667}],"1#1221376137":[{m:"c4-c5",e:6.667}],"1#392797499":[{m:"Ch3-e3",e:5}],"-1#1308497119":[{m:"Ch8-e8",e:5}],"1#781673956":[{m:"Ri1-i2",e:5}],"-1#2077436300":[{m:"Hh10-g8",e:5}],"1#-1190407487":[{m:"Hh1-g3",e:5}],"-1#-155812087":[{m:"Cb8-d8",e:7.5},{m:"Ri10-h10",e:7.5},{m:"Cb8-c8",e:7.5}],"1#-1678513158":[{m:"Ra1-b1",e:5}],"-1#-1386276090":[{m:"Ra10-b10",e:5}],"1#-1792199265":[{m:"Cb3-b7",e:5}],"-1#-1985888923":[{m:"Af10-e9",e:5}],"1#-2062910985":[{m:"g4-g5",e:5}],"-1#-910061798":[{m:"Ri10-h10",e:5}],"1#-1820265749":[{m:"c4-c5",e:5}],"-1#1553190499":[{m:"Rh10-h6",e:5}],"1#-1393097992":[{m:"g4-g5",e:6.667},{m:"Ri2-d2",e:6.667}],"-1#-532876267":[{m:"Rh10-h6",e:7.5}],"1#1173048655":[{m:"Ri2-d2",e:7.5},{m:"Ra1-a2",e:7.5}],"-1#47885851":[{m:"Af10-e9",e:8},{m:"Rh10-h6",e:8}],"1#-1492314303":[{m:"Ra1-a2",e:8.75}],"1#2051552619":[{m:"Ra1-b1",e:5}],"-1#1290061207":[{m:"c7-c6",e:5}],"1#-1887224148":[{m:"Ri2-d2",e:5}],"-1#565088847":[{m:"c6-c5",e:5}],"1#-1350256594":[{m:"Hc3-e2",
e:5}],"-1#-2064870743":[{m:"Ra10-b10",e:5}],"1#-1130447824":[{m:"Cb3-b7",e:5}],"1#1750526609":[{m:"Ch3-f3",e:9.333},{m:"Ra1-b1",e:9.333},{m:"Hb1-c3",e:9.231},{m:"Hb1-c3",e:9.796}],"-1#1292549160":[{m:"c7-c6",e:9.966},{m:"g7-g6",e:9.966},{m:"Hh10-i8",e:9.966},{m:"Hb10-c8",e:9.966}],"1#-1905441005":[{m:"Hh1-g3",e:5}],"-1#-1043272997":[{m:"Ch8-g8",e:5}],"1#944786261":[{m:"Ra1-b1",e:8.75}],"1#-982414380":[{m:"Hh1-g3",e:7.5}],"1#1545252500":[{m:"c4-c5",e:9.965}],"-1#1593449069":[{m:"Hb10-c8",e:8.75}],"1#1340737745":[{m:"Hh1-g3",e:8.75},{m:"c4-c5",e:8.75},{m:"Cb3-a3",e:8.75}],"-1#5743897":[{m:"Ra10-b10",e:8.75},{m:"c7-c6",e:8.75}],"1#941984640":[{m:"c4-c5",e:8.571}],"-1#2087977405":[{m:"c7-c6",e:6.667},{m:"Ch8-f8",e:6.667}],"1#-1083352172":[{m:"Hh1-g3",e:5}],"-1#669730649":[{m:"Hb10-c8",e:8.75}],"1#922441189":[{m:"g4-g5",e:8.75},{m:"Hh1-g3",e:8.75}],"-1#2050007816":[{m:"e7-e6",e:9.444},{m:"c7-c6",e:9.444}],"1#-1628993776":[{m:"Ch3-d3",e:6.667},{m:"c4-c5",e:6.667}],"-1#497390280":[{m:"Hb10-c8",e:5}],"1#213221492":[{m:"Cb3-a3",e:5}],"-1#1059817752":[{m:"c7-c6",e:5}],"1#-62098909":[{m:"Ra1-b1",e:5}],"-1#-891256097":[{m:"Ra10-b10",e:5}],"1#-225268666":[{m:"Rb1-b5",e:5}],"-1#-1438867843":[{m:"Hh10-g8",e:5}],"1#1759798576":[{m:"c4-c5",e:5}],"-1#-1476961864":[{m:"c6xc5",e:5}],"1#-1668315092":[{m:"Rb5xc5",e:5}],"-1#-1562708738":[{m:"Ec10-e8",e:5}],"1#-1907821539":[{m:"Hh1-g3",e:5}],"-1#-1040885291":[{m:"Ri10-h10",e:5}],"1#-1682693084":[{m:"Af1-e2",e:5}],"-1#-1007825170":[{m:"g7-g6",e:5}],"1#1050127362":[{m:"Ch3-f3",e:9.091},{m:"Hh1-g3",e:9.091},{m:"Ra1-a2",e:9.091},{m:"g4-g5",e:9.091},{m:"Cb3-a3",e:9.091},{m:"Hb1-c3",e:9.997}],"-1#466352827":[{m:"Cb8-c8",e:9.6},{m:"c7-c6",e:9.6},{m:"g7-g6",e:9.6},{m:"Hh10-g8",e:9.6}],"1#-1758088999":[{m:"Hh1-g3",e:5}],"-1#-662168303":[{m:"Hh10-g8",e:5}],"1#-659816064":[{m:"g4-g5",e:5}],"-1#-1805125779":[{m:"Hb10-c8",e:5}],"1#1855000006":[{m:"Hh1-g3",e:5}],"-1#556572686":[{m:"Hh10-g8",e:5}],"1#-653065738":[{m:"g4-g5",e:9.545},{m:"Hh1-g3",e:9.545}],"-1#1898578378":[{m:"Hh10-g8",e:8}],"1#-1275921785":[{m:"Ri1-h1",e:8}],"-1#-1183866441":[{m:"Ri10-h10",e:8},{m:"Ri10-i9",e:8}],"1#-483468218":[{m:"g4-g5",e:7.5},{m:"Hb1-c3",e:5}],"-1#-1343935829":[{m:"Hb10-a8",e:8},{m:"Rh10-h6",e:8},{m:"c7-c6",e:8}],"1#-445486423":[{m:"Ch3-h7",e:5}],"1#1820512656":[{m:"Ch3-h7",e:5}],"-1#1372074607":[{m:"g7-g6",e:6.667},{m:"Rh10-h6",e:6.667}],"1#613598482":[{m:"c4-c5",e:5}],"-1#-343803494":[{m:"Hb10-a8",e:8.889},{m:"Cb8-b4",e:8.889}],"1#-1592346216":[{m:"a4-a5",e:8.333},{m:"Ad1-e2",e:8.333}],"-1#-1887953708":[{m:"Cb8-d8",e:6.667}],"-1#-299915112":[{m:"Ad10-e9",e:8}],"1#1447866526":[{m:"Hc3-d5",e:8.571},{m:"Hc3-b5",e:8.571},{m:"Ad1-e2",e:8.571}],"1#-199259339":[{m:"Ad1-e2",e:5}],"-1#-1156146635":[{m:"Cb8-c8",e:5}],"1#938004567":[{m:"c4-c5",e:5}],"-1#-117707553":[{m:"Rh6-b6",e:5}],"1#97342906":[{m:"Ra1-b1",e:5}],"-1#862037318":[{m:"Hb10-a8",e:5}],"1#2046223684":[{m:"g4-g5",e:5}],"-1#893195177":[{m:"Ce8-f8",e:5}],"1#-2003824694":[{m:"Ch3-h5",e:5}],"-1#-120634935":[{m:"Ec10-e8",e:5}],"1#-121276973":[{m:"Hb1-c3",e:5}],"-1#-1887520052":[{m:"Hb10-c8",e:6.667}],"1#-1636915088":[{m:"c4-c5",e:6.667}],"-1#1367184632":[{m:"g7-g6",e:6.667},{m:"Ri9-d9",e:6.667}],"1#606561157":[{m:"Rh1-h7",e:5}],"-1#-1630701064":[{m:"Ri9-d9",e:5}],"1#1640616007":[{m:"Ec1-e3",e:5}],"-1#-751878546":[{m:"Rd9-d4",e:5}],"1#-1036874325":[{m:"Ra1-c1",e:5}],"-1#1718746087":[{m:"Cb8-a8",e:5}],"1#-1351366617":[{m:"Rh7-g7",e:5}],"-1#-1097778737":[{m:"Ra10-b10",e:5}],"1#-2031937706":[{m:"Cb3-a3",e:5}],"-1#-1250091462":[{m:"Rb10-b6",e:5}],"1#-965777492":[{m:"g4-g5",e:5}],"-1#-1968926399":[{m:"c7-c6",e:5}],"1#1237543546":[{m:"Hg3-f5",e:5}],"-1#523319581":[{m:"Rd4-c4",e:5}],"1#1816951989":[{m:"Ca3-a2",e:5}],"-1#-1155729283":[{m:"Rb6-b2",e:5}],"1#2028843831":[{m:"Ad1-e2",e:5}],"-1#937730615":[{m:"Ce8-e9",e:5}],"1#-669079990":[{m:"Ci3-f3",e:5}],"-1#-1759246179":[{m:"Rc4-b4",e:5}],"1#10620422":[{m:"c5xc6",e:5}],"-1#1060206034":[{m:"Ce9-g9",e:5}],"1#-1765728215":[{m:"Rg7-f7",e:5}],"-1#-1473858280":[{m:"Ad10-e9",e:5}],"1#1156025833":[{m:"g5xg6",e:5}],"-1#801805823":[{m:"Cg9xg6",e:5}],"1#558091297":[{m:"Rf7-g7",e:5}],"-1#530864400":[{m:"Ec10-e8",e:5}],"1#859199987":[{m:"c6-c7",e:5}],"-1#1565820743":[{m:"Hc8-d10",e:5}],"1#-619933324":[{m:"Hf5-d6",e:5}],"-1#895796954":[{m:"Cg6-e6",e:5}],"1#-1399676184":[{m:"Cf3-g3",e:5}],"-1#-1964122362":[{m:"Rb4-d4",e:5}],"1#1942727492":[{m:"Hc3-b5",e:5}],"-1#988366120":[{m:"Rd4-d5",e:5}],"1#1189542533":[{m:"Ca2xa7",e:5}],"-1#-648965853":[{m:"Ee8-c6",e:5}],"1#1351205117":[{m:"Cg3xg8",e:5}],"-1#-1082474418":[{m:"Rb2xb5",e:5}],"1#-199337465":[{m:"Ca7xe7+",e:5}],"-1#-1387980223":[{m:"Ca8-e8",e:5}],"1#1278355800":[{m:"Cg8-h8",e:5}],"-1#-785411058":[{m:"Rd5-h5",e:5}],"1#-383936155":[{m:"e4-e5",e:5}],"-1#1855093801":[{m:"Ce6xe3+",e:5}],"1#2113655136":[{m:"Eg1xe3",e:5}],"-1#641014826":[{m:"Rh5xh8",e:5}],"1#-1000064971":[{m:"Hd6-f7",e:5}],"-1#-70650087":[{m:"Rh8-f8",e:5}],"1#-1726700267":[{m:"Ce7-e6",e:5}],"-1#1659918384":[{m:"Hd10-b9",e:5}],"1#-2029100412":[{m:"Rc1xc6",e:5}],"-1#416141707":[{m:"Rb5-d5",e:5}],"1#-1749319995":[{m:"Rc6-b6",e:5}],"1#-1367786169":[{m:"Cb3-a3",e:7.5},{m:"Rh1-h7",e:7.5},{m:"Ad1-e2",e:7.5}],"-1#-1645792213":[{m:"e7-e6",e:5}],"1#1060454748":[{m:"Ra1-b1",e:5}],"-1#161067424":[{m:"Ra10-b10",e:5}],"1#837525305":[{m:"Rb1-b7",e:5}],"-1#289354906":[{m:"Ce8-e7",e:5}],"1#62888971":[{m:"Rb7-b5",e:5}],"-1#1712861922":[{m:"Cb8-a8",e:5}],"1#-1357250270":[{m:"Rb5xb10",e:5}],"-1#2058557803":[{m:"Hc8xb10",e:5}],"1#-53060121":[{m:"Rh1-h5",e:5}],"-1#1813893967":[{m:"Hb10-c8",e:5}],"1#2098053619":[{m:"Af1-e2",e:5}],"-1#626273081":[{m:"Ce7-e9",e:5}],"1#-973885276":[{m:"Hc3-d5",e:5}],"-1#-273658215":[{m:"Rd9-d7",e:5}],"1#-900223518":[{m:"Ca3-d3",e:5}],"-1#-557523964":[{m:"Rd7-f7",e:5}],"-1#345188154":[{m:"e7-e6",e:5}],"1#-1237233075":[{m:"Af1-e2",e:5}],"-1#-300369785":[{m:"Hc8-e7",e:5}],"1#-532702061":[{m:"Hc3-b5",e:5}],"-1#-1457687809":[{m:"Cb8xb3",e:5}],"1#-685851416":[{m:"Ci3xb3",e:5}],"-1#-395060746":[{m:"e6-e5",e:5}],"1#78896450":[{m:"e4xe5",e:5}],"-1#1787454697":[{m:"He7-f5",e:5}],"1#-385705261":[{m:"Ec1-e3",e:5}],"-1#1541698810":[{m:"Rd9-d4",e:5}],"1#1257883455":[{m:"Hb5xc7",e:5}],"-1#-1188067798":[{m:"Ra10-b10",e:5}],"1#-2124568397":[{m:"Hc7xe8",e:5}],"-1#-334322527":[{m:"Ec10xe8",e:5}],"1#1117682102":[{m:"Cb3-d3",e:5}],"-1#349974429":[{m:"Rd4xg4",e:5}],"-1#-512742329":[{m:"Rd9-d4",e:5}],"1#-261251198":[{m:"Rh1-h5",e:5}],"-1#1621496106":[{m:"e7-e6",e:5}],"1#-1032559523":[{m:"Cb3-b7",e:5}],"-1#-554111833":[{m:"e6-e5",e:5}],"1#842590227":[{m:"Rh5xe5",e:5}],"-1#-626547679":[{m:"Hg8-e7",e:5}],"1#586890240":[{m:"Re5-h5",e:5}],"-1#600976597":[{m:"c7-c6",e:5}],"1#-524953618":[{m:"Ec1-e3",e:5}],"-1#1381185991":[{m:"Rd4-c4",e:5}],"1#556694639":[{m:"Ra1-c1",e:5}],"-1#-2056451549":[{m:"Hc8-d6",e:5}],"1#-1344298592":[{m:"Ci3xi7",e:5}],"-1#-129998160":[{m:"g7-g6",e:5}],"1#-1927637555":[{m:"Ci7-i10",e:5}],"-1#-1509305246":[{m:"Ce8-d8",e:5}],"-1#-1210702679":[{m:"Hh10-g8",e:5}],"1#1963909092":[{m:"Hh1-g3",e:5}],"-1#984838700":[{m:"Ri10-h10",e:5}],"1#1626476509":[{m:"Ri1-h1",e:5}],"-1#1785681133":[{m:"Hb10-a8",e:5}],"1#553129199":[{m:"g4-g5",e:5}],"-1#1815339522":[{m:"Rh10-h6",e:5}],"-1#1918655215":[{m:"Hh10-g8",e:5}],"1#-1333485150":[{m:"Hh1-g3",e:5}],"-1#-13038486":[{m:"Ri10-h10",e:6.667},{m:"Hb10-a8",e:6.667}],"1#-1518833253":[{m:"g4-g5",e:7.5}],"1#-1246868376":[{m:"Ri1-h1",e:5}],"-1#218735982":[{m:"Hb10-c8",e:5}],"1#471447506":[{m:"Ra1-b1",e:5}],"-1#716523310":[{m:"Ra10-b10",e:5}],"1#315058615":[{m:"Rb1-b7",e:5}],"-1#840155668":[{m:"Cb8-a8",e:5}],"1#-82710060":[{m:"Rb7xc7",e:5}],"-1#1677731302":[{m:"Hh10-g8",e:7.5}],"1#-1495736661":[{m:"Hh1-g3",e:7.5}],"-1#-379227293":[{m:"c7-c6",e:9.63},{m:"Ri10-i9",e:9.63},{m:"Hb10-c8",e:9.63},{m:"Ri10-h10",e:9.63}],"-1#-1992314714":[{m:"Cb8-c8",e:9.998},{m:"Ch8-g8",e:9.998},{m:"Cb8-g8",e:9.998},{m:"Ch8-d8",e:9.998},{m:"Ec10-e8",e:9.998},{m:"Hh10-g8",e:9.998},{m:"g7-g6",e:9.998},{m:"Hb10-c8",e:9.998},{m:"Hh10-i8",e:9.998},{m:"Ch8-e8",e:9.998},{m:"c7-c6",e:9.998},{m:"Hb10-a8",e:9.998},{m:"e7-e6",e:9.998},{m:"Ch8-c8",e:9.998},{m:"Eg10-e8",e:9.998},{m:"Ch8-f8",e:9.998},{m:"Cb8-f8",e:9.998},{m:"Cb8-d8",e:9.998},{m:"Cb8-e8",e:9.998}],"1#96598724":[{m:"g4-g5",e:9.167},{m:"c4-c5",e:9.167},{m:"Hb1-a3",e:9.167}],"-1#1225395241":[{m:"Hb10-a8",e:7.5}],"1#60640299":[{m:"Hb1-c3",e:8}],"-1#1371875174":[{m:"c7-c6",e:8},{m:"Ra10-b10",e:8}],"1#-1834820515":[{m:"Ra1-b1",e:6.667}],"1#1773603327":[{m:"Ra1-b1",e:7.5}],"-1#1595668739":[{m:"Rb10-b6",e:7.5}],"-1#438257308":[{m:"Ch8-e8",e:8.571},{m:"a7-a6",e:8.571},{m:"Hb10-a8",e:8.571}],"1#2037790631":[{m:"Hh1-g3",e:6.667}],"-1#919313007":[{m:"Hh10-g8",e:6.667}],"1#507337630":[{m:"Ra1-b1",e:6.667}],"1#1351091870":[{m:"Ra1-b1",e:6.667}],"1#-3891604":[{m:"c4-c5",e:6.667},{m:"g4-g5",e:6.667}],"-1#819438308":[{m:"Hh10-i8",e:5}],"1#-1196649192":[{m:"Hb1-c3",e:5}],"-1#-353042859":[{m:"Ri10-h10",e:5}],"1#-1330281564":[{m:"Hh1-f2",e:5}],"-1#-2032123595":[{m:"Cb8-f8",e:5}],"1#-1267808571":[{m:"Ra1-b1",e:5}],"-1#-2101201351":[{m:"Hb10-c8",e:5}],"1#-1814944635":[{m:"Ri1-h1",e:5}],"-1#-1722843211":[{m:"Rh10-h6",e:6.667}],"1#1016645359":[{m:"Ch3-i3",e:6.667},{m:"Ch3-g3",e:6.667}],"-1#-1290835839":[{m:"Cb8-e8",e:9.811},{m:"Hh10-i8",e:9.811},{m:"c7-c6",e:9.811}],"1#-2035851479":[{m:"Hh1-g3",e:9},{m:"Hb1-c3",e:9}],"1#997482365":[{m:"i4-i5",e:9.767},{m:"Hh1-f2",e:9.767}],"1#1885901754":[{m:"Hh1-g3",e:5}],"-1#1070939762":[{m:"Hh10-i8",e:5}],"1#-2145072481":[{m:"Ra1-a2",e:6.667},{m:"Hb1-c3",e:6.667}],"-1#157631028":[{m:"Ra10-a8",e:5}],"1#-798878996":[{m:"Ra2-f2",e:5}],"-1#1648401344":[{m:"Ra8-f8",e:5}],"1#1706252574":[{m:"Ch3-i3",e:5}],"-1#302552577":[{m:"Eg10-e8",e:5}],"1#-782914818":[{m:"c4-c5",e:5}],"-1#507942518":[{m:"Hh10-f9",e:5}],"1#-383255691":[{m:"Hb1-c3",e:5}],"-1#-1149267912":[{m:"Hb10-c8",e:5}],"1#-1435532668":[{m:"Hc3-d5",e:5}],"-1#-2144568135":[{m:"Ri10-h10",e:5}],"-1#-763584046":[{m:"Hb10-c8",e:5}],"1#-1016286354":[{m:"Ra1-b1",e:5}],"-1#-171949166":[{m:"Ra10-b10",e:5}],"1#-843944693":[{m:"Cb3-b7",e:5}],"-1#-784407055":[{m:"c7-c6",e:5}],"1#307830474":[{m:"Hh1-f2",e:5}],"-1#604822619":[{m:"Eg10-e8",e:5}],"1#-414064476":[{m:"Ch3-i3",e:5}],"-1#-1863700549":[{m:"Hh10-f9",e:5}],"1#1737179832":[{m:"Ri1-h1",e:5}],"1#-1630791317":[{m:"Eg1-e3",e:9.945},{m:"Hh1-g3",e:9.992},{m:"Eg1-e3",e:8.571},{m:"Cb3-d3",e:9.992},{m:"Hb1-a3",e:9.992},{m:"Hh1-i3",e:9.992},{m:"Hh1-f2",e:9.992},{m:"Ch3-g3",e:9.992},{m:"Hb1-c3",e:9.992},{m:"Ch3-f3",e:9.992},{m:"Ri1-i2",e:9.992}],"-1#-781077341":[{m:"Hh10-g8",e:9.985}],"-1#-771231866":[{m:"Hh10-g8",e:9.902},{m:"Eg10-e8",e:9.902},{m:"c7-c6",e:9.902}],"1#283055307":[{m:"Hh1-f2",e:9.898}],"1#291165049":[{m:"Hh1-g3",e:5}],"-1#1592229553":[{m:"c7-c6",e:5}],"1#291509437":[{m:"Ri1-i2",e:7.5}],"-1#-1541646704":[{m:"Cb8-c8",e:9.333},{m:"c7-c6",e:9.333}],"-1#-2129484493":[{m:"Hh10-g8",e:9.6}],"-1#-2025711275":[{m:"Hh10-g8",e:8}],"1#1167778328":[{m:"i4-i5",e:8}],"-1#-1466311686":[{m:"Hh10-g8",e:8.333}],"-1#-2144205491":[{m:"Hh10-g8",e:9.091}],"-1#-862686682":[{m:"c7-c6",e:9.655}],"-1#-1148170286":[{m:"Hh10-g8",e:9.375}],"-1#-880257789":[{m:"Hb10-a8",e:9.839}],"1#-1515343803":[{m:"g4-g5",e:9.902},{m:"Hb1-a3",e:9.902},{m:"Cb3-d3",e:9.902},{m:"Hh1-g3",e:9.902},{m:"Hb1-c3",e:9.902},{m:"Eg1-e3",e:9.99}],"-1#-379173208":[{m:"c7-c6",e:9.75},{m:"Hb10-d9",e:9.75}],"-1#-1166865379":[{m:"g7-g6",e:9.231},{m:"c7-c6",e:9.231},{m:"Ec10-e8",e:9.524}],"-1#-1619132482":[{m:"c7-c6",e:8.571},{m:"Hb10-c8",e:8.571},{m:"Hh10-i8",e:8.571}],"-1#-368042611":[{m:"Hb10-c8",e:9.167},{m:"Hh10-i8",e:9.167},{m:"g7-g6",e:9.167}],"-1#-134882552":[{m:"Hh10-g8",e:8.75},{m:"c7-c6",e:8.75}],"1#881991731":[{m:"g4-g5",e:8.333}],"1#1273449451":[{m:"g4-g5",e:9.898},{m:"Hb1-c3",e:9.898},{m:"Cb3-d3",e:9.898},{m:"c4-c5",e:9.898},{m:"Hh1-g3",e:9.898},{m:"Ch3-g3",e:9.898},{m:"Hb1-a3",e:9.898}],"-1#120372486":[{m:"Hb10-a8",e:9.836},{m:"Ch8-i8",e:9.836},{m:"c7-c6",e:9.836},{m:"Cb8-e8",e:9.836},{m:"Hb10-c8",e:9.836},{m:"Ec10-e8",e:9.836},{m:"Ri10-i9",e:9.836}],"1#1183213922":[{m:"Hh1-g3",e:5}],"-1#431956134":[{m:"Hh10-g8",e:8.75},{m:"Hh10-g8",e:9.949},{m:"c7-c6",e:8.571}],"-1#1899430928":[{m:"Ec10-e8",e:7.5},{m:"c7-c6",e:7.5},{m:"Ch8-i8",e:7.5}],"-1#-2064353437":[{m:"g7-g6",e:9.412},{m:"Cb8-e8",e:9.412}],"-1#73066019":[{m:"c7-c6",e:8.571},{m:"Hh10-g8",e:9.231}],"1#-952296168":[{m:"Hb1-a3",e:5}],"-1#1427724237":[{m:"Ri10-h10",e:5}],"1#257436220":[{m:"c4-c5",e:5}],"-1#1413085107":[{m:"g7-g6",e:8.571},{m:"Ri10-i9",e:8.571},{m:"Hb10-c8",e:8.571}],"1#-60471333":[{m:"Hh1-g3",e:9.985},{m:"Ch3-f3",e:9.985},{m:"Cb3-d3",e:9.985},{m:"Hh1-i3",e:9.985},{m:"Ch3-g3",e:9.985},{m:"Eg1-e3",e:9.89},{m:"Eg1-e3",e:9.996},{m:"Eg1-e3",e:9.924},{m:"Hh1-f2",e:9.985}],"-1#-1277629933":[{m:"Hh10-g8",e:9.231},{m:"Ch8-g8",e:9.231},{m:"g7-g6",e:5}],"1#-112219631":[{m:"c4-c5",e:6.667},{m:"Hb1-a3",e:6.667}],"-1#-650571422":[{m:"Hh10-g8",e:5}],"1#467790383":[{m:"Hh1-g3",e:5}],"-1#1415333863":[{m:"Ri10-h10",e:5}],"-1#-961214432":[{m:"Hb10-a8",e:8},{m:"Hh10-g8",e:8}],"1#-1943910366":[{m:"a4-a5",e:7.5}],"-1#-437565467":[{m:"Hh10-g8",e:5}],"1#657702056":[{m:"g4-g5",e:5}],"-1#-493134851":[{m:"Hh10-i8",e:9.697},{m:"Eg10-e8",e:9.697}],"-1#-902789814":[{m:"Ec10-e8",e:9.474},{m:"Ch8-f8",e:9.474},{m:"Eg10-e8",e:9.474}],"1#-1741708774":[{m:"Hh1-f2",e:9.985},{m:"Eg1-e3",e:9.688},{m:"Hb1-c3",e:9.985},{m:"Hh1-g3",e:9.985},{m:"Eg1-e3",e:9.942},{m:"c4-c5",e:9.985},{m:"Cb3-c3",e:9.985}],"-1#-1367711605":[{m:"Ch8-e8",e:5}],"1#-854388304":[{m:"Ch3-g3",e:5}],"-1#-739439210":[{m:"Ra10-a9",e:5}],"-1#-898119337":[{m:"Ch8-e8",e:7.5},{m:"Hb10-c8",e:6.667}],"1#-1457604500":[{m:"Ch3-f3",e:7.5}],"1#152056428":[{m:"Cb3-a3",e:8}],"-1#-678293550":[{m:"Cb8-a8",e:9.878},{m:"g7-g6",e:9.878},{m:"Ra10-a9",e:9.878}],"-1#-723233545":[{m:"Cb8-a8",e:9.958},{m:"Hh10-i8",e:9.958}],"-1#1463590546":[{m:"Cb8-a8",e:9.97},{m:"Ch8-e8",e:9.97},{m:"Ra10-a9",e:9.97},{m:"Hh10-i8",e:9.97}],"-1#-1832419069":[{m:"g7-g6",e:8},{m:"Ra10-b10",e:8},{m:"e7-e6",e:8}],"1#21268314":[{m:"Hb1-a3",e:9.615},{m:"i4-i5",e:9.615},{m:"Hh1-g3",e:9.615},{m:"c4-c5",e:9.615}],"-1#513424130":[{m:"a7-a6",e:5}],"1#448275968":[{m:"Hh1-g3",e:5}],"-1#1426426824":[{m:"g7-g6",e:5}],"1#543128757":[{m:"Af1-e2",e:5}],"-1#-1084514502":[{m:"Ch8-g8",e:6.667}],"1#-912215568":[{m:"Hh1-i3",e:6.667}],"-1#-802246194":[{m:"Ri10-h10",e:6.667}],"1#-1972384705":[{m:"Ri1-h1",e:6.667}],"-1#-2131585265":[{m:"Cb8-e8",e:6.667}],"-1#1324952210":[{m:"c7-c6",e:9.5},{m:"g7-g6",e:9.5},{m:"Hh10-i8",e:9.902},{m:"Cb8-f8",e:9.5},{m:"Hh10-i8",e:9.167}],"-1#-833111086":[{m:"Ch8-f8",e:7.5},{m:"Ec10-e8",e:7.5}],"1#223273467":[{m:"Hh1-g3",e:8}],"1#-490357967":[{m:"Hh1-g3",e:8.889},{m:"Hb1-c3",e:8.889}],"1#-363413091":[{m:"Hh1-g3",e:9.983},{m:"c4-c5",e:9.983},{m:"g4-g5",e:9.983},{m:"Hb1-c3",e:9.983},{m:"Af1-e2",e:9.983}],"-1#-1511297963":[{m:"Hh10-g8",e:9.979},{m:"g7-g6",e:9.979},{m:"Ri10-i9",e:9.979}],"-1#625343765":[{m:"Hh10-g8",e:6.667}],"1#-409139624":[{m:"Eg1-e3",e:9.688}],"-1#-1499646096":[{m:"Hh10-g8",e:9}],"1#1682295869":[{m:"Hb1-c3",e:9},{m:"Hh1-g3",e:9}],"-1#737698293":[{m:"Cb8-d8",e:9.792}],"-1#-1206998320":[{m:"Cb8-c8",e:9.904},{m:"Hb10-a8",e:9.904},{m:"Hh10-g8",e:9.904},{m:"c7-c6",e:9.904}],"-1#-1307628713":[{m:"Hh10-g8",e:5}],"1#1893191706":[{m:"Hh1-g3",e:5}],"-1#1063943634":[{m:"Ri10-h10",e:5}],"1#1697316899":[{m:"Ri1-h1",e:5}],"1#1247300509":[{m:"Cb3-c3",e:9.972},{m:"Eg1-e3",e:9.981},{m:"Hh1-g3",e:9.972},{m:"Hh1-f2",e:9.972},{m:"Hb1-a3",e:9.972},{m:"Hb1-c3",e:9.972}],"-1#1085302916":[{m:"g7-g6",e:9.95},{m:"Hb10-a8",e:9.95},{m:"Hh10-g8",e:9.95}],"-1#110345584":[{m:"Cb8-e8",e:9.915},{m:"c7-c6",e:9.75}],"-1#98952789":[{m:"Hb10-c8",e:8.75}],"1#351663337":[{m:"Af1-e2",e:9.868},{m:"g4-g5",e:9.868}],"-1#2081261836":[{m:"Hb10-c8",e:8.333}],"1#1830656944":[{m:"Hf2-d3",e:8.333}],"-1#-1628080829":[{m:"Cb8-a8",e:8.333}],"-1#1434908613":[{m:"Ch8-e8",e:9.714},{m:"Cb8-e8",e:9.714},{m:"c7-c6",e:9.524}],"-1#402661584":[{m:"Hb10-c8",e:6.667}],"1#-1012338524":[{m:"Hh1-g3",e:9.677},{m:"g4-g5",e:9.677},{m:"Hb1-c3",e:9.677},{m:"a4-a5",e:9.677},{m:"c4-c5",e:9.677}],"-1#-1944756884":[{m:"g7-g6",e:5}],"-1#-1889335735":[{m:"Ra10-a9",e:8.333},{m:"Hb10-a8",e:7.5},{m:"Eg10-e8",e:8.333}],"-1#-1846502423":[{m:"Cb8-d8",e:9.524},{m:"Ra10-a9",e:9.524},{m:"c7-c6",e:9.524},{m:"Hh10-g8",e:9.524}],"-1#-305768984":[{m:"Ch8-e8",e:7.5},{m:"Eg10-e8",e:7.5},{m:"Ch8-d8",e:7.5}],"1#-1901124397":[{m:"Hb1-a3",e:5}],"-1#213634092":[{m:"Ch8-d8",e:5}],"1#737002961":[{m:"c4-c5",e:7.5},{m:"Hb1-c3",e:7.5},{m:"Hh1-g3",e:7.5}],"-1#-453052071":[{m:"Ch8-e8",e:5}],"1#-2020112286":[{m:"Hh1-g3",e:5}],"-1#-936761942":[{m:"Hh10-g8",e:5}],"1#183688935":[{m:"Ri1-h1",e:5}],"-1#7308759":[{m:"Hb10-c8",e:5}],"1#293574507":[{m:"Hb1-c3",e:8.75}],"-1#1126693926":[{m:"Ra10-a9",e:8.75}],"-1#2041949852":[{m:"Cb8-e8",e:5}],"1#1277008180":[{m:"Hh1-g3",e:5}],"-1#60830972":[{m:"Hb10-c8",e:6.667},{m:"Hh10-g8",e:6.667}],"1#313534016":[{m:"Ra1-b1",e:5}],"-1#605869756":[{m:"Ra10-a9",e:5}],"1#1011175421":[{m:"Af1-e2",e:5}],"-1#1679598903":[{m:"Hh10-g8",e:5}],"1#-1049047119":[{m:"g4-g5",e:5}],"-1#-1917634212":[{m:"Hb10-c8",e:5}],"1#-1667028000":[{m:"Af1-e2",e:5}],"-1#1682991129":[{m:"Cb8-e8",e:5}],"1#1375231921":[{m:"Hh1-g3",e:5}],"1#1908397596":[{m:"Ri1-i2",e:9.167},{m:"Hh1-g3",e:9.167},{m:"Hb1-a3",e:9.167}],"-1#620468852":[{m:"Hh10-g8",e:6.667}],"1#-433888967":[{m:"Ri2-d2",e:6.667}],"-1#1208929754":[{m:"Cc8-f8",e:6.667},{m:"Ec10-e8",e:6.667}],"1#1850394168":[{m:"c4-c5",e:6.667},{m:"Hb1-a3",e:6.667}],"1#1687997753":[{m:"c4-c5",e:5}],"-1#1040350164":[{m:"Ri10-i8",e:8},{m:"g7-g6",e:8},{m:"Hh10-g8",e:8}],"1#1699177799":[{m:"Hb1-a3",e:5}],"1#1264094377":[{m:"Hb1-a3",e:5}],"1#-52789095":[{m:"Ri1-h1",e:6.667}],"-1#1851877956":[{m:"Hh10-g8",e:8.333},{m:"a7-a6",e:8.333},{m:"Ri10-i8",e:8.333}],"1#-1397124855":[{m:"Cb3-d3",e:6.667},{m:"Hh1-g3",e:6.667}],"1#1782806342":[{m:"Ra1-a2",e:6.667}],"1#891581655":[{m:"Ra1-a2",e:5}],"1#1247972441":[{m:"c4-c5",e:9.888},{m:"Hh1-g3",e:9.888},{m:"Hb1-a3",e:9.888},{m:"g4-g5",e:9.888},{m:"Hb1-c3",e:9.888},{m:"Cb3-d3",e:9.888}],"-1#-2056146735":[{m:"Hb10-a8",e:9.808},{m:"Hh10-f9",e:9.808},{m:"Ch8-f8",e:9.808}],"-1#98509201":[{m:"g7-g6",e:7.5}],"1#1887819500":[{m:"c4-c5",e:7.5}],"-1#-1080628636":[{m:"Hh10-g8",e:8}],"-1#1438396417":[{m:"a7-a6",e:6.667}],"1#1369320707":[{m:"g4-g5",e:6.667},{m:"Ra1-a2",e:6.667}],"-1#111770292":[{m:"Hb10-c8",e:9.667},{m:"Eg10-e8",e:8.333}],"-1#406513428":[{m:"g7-g6",e:7.5},{m:"Hb10-a8",e:7.5},{m:"c7-c6",e:7.5}],"-1#1890763682":[{m:"g7-g6",e:6.667},{m:"Hb10-a8",e:6.667}],"1#99103967":[{m:"Hb1-c3",e:5}],"1#1244064399":[{m:"Cb3-d3",e:9.937},{m:"c4-c5",e:9.937},{m:"Hb1-a3",e:9.937},{m:"g4-g5",e:9.937},{m:"Hh1-g3",e:9.937}],"-1#1895212404":[{m:"Hh10-g8",e:5}],"1#-1305584071":[{m:"Hb1-c3",e:5}],"-1#-529123980":[{m:"Hb10-c8",e:5}],"-1#-2060069369":[{m:"g7-g6",e:9.091},{m:"Hh10-g8",e:9.091},{m:"Ch8-f8",e:7.5}],"-1#1442338519":[{m:"Hh10-g8",e:8},{m:"Hb10-c8",e:8}],"1#-1759466086":[{m:"Ra1-a2",e:7.5}],"1#1156072555":[{m:"Cb3-c3",e:5}],"-1#116202594":[{m:"Hb10-c8",e:9.762},{m:"Hh10-g8",e:9.762},{m:"Hh10-i8",e:9.762}],"-1#94062407":[{m:"Hh10-i8",e:9.902},{m:"Hh10-g8",e:9.902},{m:"g7-g6",e:9.902}],"1#-951862262":[{m:"g4-g5",e:9.167}],"1#-1146013866":[{m:"Hh1-g3",e:9.925},{m:"Eg1-e3",e:9.737},{m:"Hb1-a3",e:9.925},{m:"Ra1-a2",e:9.925},{m:"Hb1-c3",e:9.925},{m:"c4-c5",e:9.925}],"-1#-200500578":[{m:"Hb10-c8",e:5}],"1#-451114974":[{m:"Hb1-a3",e:5}],"-1#-87935878":[{m:"g7-g6",e:5}],"-1#-142949957":[{m:"Hb10-c8",e:9.667}],"1#-429206777":[{m:"g4-g5",e:9.167},{m:"g4-g5",e:9.63},{m:"Cb3-d3",e:9.667}],"-1#-1536193778":[{m:"Hb10-c8",e:9.167}],"1#-1249928782":[{m:"g4-g5",e:9.167},{m:"a4-a5",e:9.167},{m:"Ra1-b1",e:9.167}],"-1#854638589":[{m:"Hb10-c8",e:9.688}],"1#601926977":[{m:"Ra2-f2",e:9.688},{m:"Hb1-a3",e:9.688}],"-1#-370582501":[{m:"Hb10-c8",e:9.667},{m:"c7-c6",e:9.667}],"1#-117879129":[{m:"g4-g5",e:9.63}],"-1#1956776926":[{m:"g7-g6",e:9.706},{m:"Hb10-c8",e:9.706}],"1#33094819":[{m:"Hb1-c3",e:5}],"1#1706170722":[{m:"Cb3-d3",e:9.697}],"1#-461757355":[{m:"g4-g5",e:9.988},{m:"Eg1-e3",e:8},{m:"Cb3-d3",e:9.988},{m:"Ra1-a2",e:9.988},{m:"Hb1-c3",e:9.988},{m:"Ch3-f3",e:9.988},{m:"Hh1-g3",e:9.988},{m:"Hb1-a3",e:9.988}],"-1#-1464741192":[{m:"Hb10-a8",e:9.892},{m:"Ch8-e8",e:9.892}],"-1#-559256658":[{m:"c7-c6",e:5}],"1#500011157":[{m:"Hb1-a3",e:5}],"-1#1832627454":[{m:"Hh10-g8",e:9.951},{m:"Ch8-e8",e:9.951}],"-1#-1239265512":[{m:"Eg10-e8",e:9.924},{m:"c7-c6",e:9.924}],"-1#-1054444820":[{m:"Hb10-a8",e:5}],"1#-1951321362":[{m:"Hh1-g3",e:5}],"-1#-1412986467":[{m:"Hb10-a8",e:7.5},{m:"Hh10-g8",e:7.5}],"-1#-73099251":[{m:"Ch8-e8",e:9.894},{m:"Hb10-c8",e:9.894}],"1#-1130920178":[{m:"Hh1-g3",e:9.878},{m:"Hb1-c3",e:9.878}],"-1#-215340346":[{m:"Hb10-c8",e:9.375},{m:"g7-g6",e:9.375}],"1#-499500934":[{m:"Cb3-d3",e:9.333},{m:"Hb1-c3",e:9.333}],"-1#-655722623":[{m:"Ra10-b10",e:9.091}],"-1#-1335733449":[{m:"g7-g6",e:9.091}],"1#-2039423557":[{m:"Cb3-d3",e:5}],"-1#-1130327488":[{m:"Hb10-c8",e:5}],"1#-1380941572":[{m:"Hb1-c3",e:5}],"-1#-1512527":[{m:"Ra10-b10",e:5}],"-1#-288363453":[{m:"Hb10-c8",e:9.851},{m:"Hh10-g8",e:9.851},{m:"c7-c6",e:9.851}],"1#-2097409":[{m:"Ra1-b1",e:9.811},{m:"Ra1-a2",e:9.811},{m:"Hb1-c3",e:9.333}],"1#739710734":[{m:"Ra1-b1",e:5}],"-1#448522226":[{m:"Ra10-a9",e:5}],"1#765990776":[{m:"Ra1-b1",e:9.286},{m:"Ra1-a2",e:9.286},{m:"g4-g5",e:9.286}],"-1#-1313231340":[{m:"Hh10-g8",e:8.889},{m:"c7-c6",e:8.889},{m:"Cb8-e8",e:8.889}],"1#1935758681":[{m:"g4-g5",e:5}],"-1#1068147636":[{m:"c7-c6",e:5}],"1#-53651313":[{m:"Hb1-c3",e:5}],"-1#-1365953598":[{m:"Hb10-c8",e:5}],"1#-1081794178":[{m:"Hh1-g3",e:5}],"-1#-264729418":[{m:"Hc8-b6",e:5}],"1#778918855":[{m:"Cb3-a3",e:5}],"-1#502485675":[{m:"Eg10-e8",e:5}],"1#-558993836":[{m:"a4-a5",e:5}],"-1#-255800552":[{m:"Hb6xc4",e:5}],"1#-1191317279":[{m:"Ca3-a2",e:5}],"-1#1873638441":[{m:"Cb8-c8",e:5}],"1#-481083829":[{m:"Ra1-b1",e:5}],"-1#-704655689":[{m:"Af10-e9",e:5}],"1#-648803803":[{m:"a5-a6",e:5}],"-1#2017188665":[{m:"Ri10-f10",e:5}],"1#-235967235":[{m:"a6-b6",e:5}],"-1#-1102265994":[{m:"Ra10-b10",e:5}],"1#-2042695697":[{m:"b6-b7",e:5}],"-1#1820805930":[{m:"Ch8-h9",e:5}],"1#888416553":[{m:"b7-b8",e:5}],"-1#1209687505":[{m:"Cc8-d8",e:5}],"1#-1266895823":[{m:"Ch3-i3",e:5}],"-1#-1010336978":[{m:"Hc4-a5",e:5}],"1#-1785621785":[{m:"Ri1-h1",e:5}],"-1#-1626551849":[{m:"Ch9-i9",e:5}],"1#1532504710":[{m:"Rb1-b5",e:5}],"-1#66459837":[{m:"c6-c5",e:5}],"1#-1914948900":[{m:"Rb5xa5",e:5}],"-1#185995069":[{m:"Rb10xb8",e:5}],"1#-778797799":[{m:"Ra5xc5",e:5}],"-1#-796778014":[{m:"Rf10-f4",e:5}],"1#2129262162":[{m:"Hg3-h5",e:5}],"-1#1332388307":[{m:"Ci9xi5",e:5}],"1#-395424696":[{m:"Eg1-e3",e:5}],"-1#1861700250":[{m:"Rf4-f10",e:5}],"1#-1063477974":[{m:"Rc5-c7",e:5}],"-1#-732285311":[{m:"Rf10-h10",e:5}],"1#437439429":[{m:"Hh5-g3",e:5}],"-1#730963012":[{m:"Rh10xh1",e:5}],"1#334241530":[{m:"Hg3xh1",e:5}],"-1#535029153":[{m:"a7-a6",e:5}],"1#465696931":[{m:"Hh1-f2",e:5}],"-1#764688946":[{m:"a6-a5",e:5}],"1#-1645302322":[{m:"Hf2-h3",e:5}],"-1#-1378817163":[{m:"Ci5-h5",e:5}],"1#-1218997804":[{m:"Ca2-f2",e:5}],"-1#901114062":[{m:"Rb8-b6",e:5}],"1#1376113208":[{m:"Af1-e2",e:5}],"-1#173816050":[{m:"a5-b5",e:5}],"1#-164357163":[{m:"Rc7-d7",e:5}],"-1#-942226401":[{m:"b5-c5",e:5}],"1#1372942706":[{m:"Rd7-c7",e:6.667},{m:"Hh3-f4",e:6.667}],"-1#1614261944":[{m:"Rb6-i6",e:5}],"1#516759205":[{m:"Cf2-f3",e:5}],"-1#5411333":[{m:"Ri6-i4",e:5}],"1#-2134105101":[{m:"g5-g6",e:5}],"-1#-490689312":[{m:"g7xg6",e:5}],"1#-1448412789":[{m:"Rc7xc5",e:5}],"-1#1093517783":[{m:"Ri4-h4",e:5}],"1#1668024103":[{m:"Hh3-g1",e:5}],"-1#-1327515592":[{m:"i7-i6",e:5}],"1#-1087211801":[{m:"Ci3-g3",e:5}],"-1#-878013777":[{m:"i6-i5",e:5}],"1#220157554":[{m:"Rc5-f5",e:5}],"-1#392505588":[{m:"Rh4-g4",e:5}],"1#1691996309":[{m:"Cg3-h3",e:5}],"-1#2049428659":[{m:"Cd8-c8",e:5}],"1#-2042550957":[{m:"Ec1-a3",e:5}],"-1#694743468":[{m:"Cc8-c4",e:5}],"1#2036577155":[{m:"Rf5-e5",e:5}],"-1#-1184526309":[{m:"e7-e6",e:5}],"1#465036652":[{m:"Re5-c5",e:5}],"-1#-602501373":[{m:"Cc4-b4",e:5}],"1#-1121006006":[{m:"Rc5-c7",e:5}],"-1#-1444387359":[{m:"i5-i4",e:5}],"1#-1126424288":[{m:"Rc7-g7",e:5}],"-1#479083025":[{m:"Cb4-b8",e:5}],"1#-1589415147":[{m:"Hc3-d5",e:5}],"-1#-1962898136":[{m:"e6-e5",e:5}],"1#1740671388":[{m:"Hd5-b6",e:5}],"-1#1032117286":[{m:"e5xe4",e:5}],"1#2080302309":[{m:"Hb6-d7",e:5}],"-1#-393357434":[{m:"Cb8-d8",e:5}],"1#-2050473099":[{m:"Ea3-c1",e:5}],"-1#719427466":[{m:"e4xe3",e:5}],"1#-407669385":[{m:"Ec1xe3",e:5}],"-1#1676107400":[{m:"Ch5-b5",e:5}],"1#491329196":[{m:"Ae2-d3",e:5}],"-1#240615974":[{m:"Cb5-b1+",e:5}],"1#-1967921881":[{m:"Ad1-e2",e:5}],"-1#-977603545":[{m:"Cb1xg1",e:5}],"1#601332461":[{m:"Ee3xg1",e:5}],"-1#823647561":[{m:"Rg4xg1+",e:5}],"1#-1099171349":[{m:"Cf3-f1",e:5}],"-1#-1614506839":[{m:"Rg1-g3",e:5}],"1#-1228551620":[{m:"Ch3-h2",e:5}],"-1#-372256875":[{m:"Rg3-e3",e:5}],"1#-1426106988":[{m:"Rg7xg8",e:5}],"-1#1480050623":[{m:"Re3-e7",e:5}],"1#2118070665":[{m:"Ch2-h10",e:5}],"-1#-1549525432":[{m:"Cd8xg8",e:5}],"1#1782699590":[{m:"Hd7-c9+",e:5}],"-1#295316721":[{m:"Ke10-f10",e:5}],"1#1825703939":[{m:"Ch10-h2",e:5}],"-1#-1320605758":[],"-1#1536331080":[{m:"Ch5-i5",e:5}],"1#1091958761":[{m:"Hf4-h3",e:5}],"-1#1263668179":[{m:"b5-c5",e:5}],"1#1927173423":[{m:"Cb3-e3",e:6.667},{m:"g4-g5",e:6.667}],"-1#-660684107":[{m:"Hb10-c8",e:5}],"1#-913387511":[{m:"Hb1-c3",e:5}],"-1#-1680426172":[{m:"Ra10-b10",e:5}],"1#-1549494819":[{m:"Ra1-a2",e:5}],"-1#719658358":[{m:"Hh10-g8",e:5}],"1#-398596549":[{m:"Hh1-g3",e:5}],"-1#-1484764173":[{m:"g7-g6",e:5}],"1#-757416818":[{m:"Ra2-d2",e:5}],"-1#115244724":[{m:"Eg10-e8",e:5}],"1#-981253557":[{m:"Rd2-d5",e:5}],"-1#-591262625":[{m:"Hg8-f6",e:5}],"1#2125715692":[{m:"Rd5-f5",e:5}],"-1#-982309756":[{m:"Cb8-b6",e:5}],"1#144217531":[{m:"c4-c5",e:5}],"-1#-947148493":[{m:"Ch8-f8",e:5}],"1#76739354":[{m:"Rf5-h5",e:5}],"-1#-289191644":[{m:"c6xc5",e:5}],"1#-709125968":[{m:"Rh5xc5",e:5}],"-1#-1918610681":[{m:"Ri10-h10",e:5}],"1#-672846090":[{m:"Ri1-h1",e:5}],"-1#-579308090":[{m:"Rh10-h4",e:5}],"1#423205521":[{m:"Ch3-i3",e:5}],"-1#1854035342":[{m:"Rh4xg4",e:5}],"1#253136777":[{m:"Ci3xi7",e:5}],"-1#1485393049":[{m:"Rb10-b8",e:5}],"1#1375090824":[{m:"Rh1-h8",e:5}],"-1#-2144051971":[{m:"Ad10-e9",e:5}],"1#1828021260":[{m:"Rc5-c6",e:5}],"-1#1222123954":[{m:"Rg4xg3",e:5}],"1#709181336":[{m:"Rc6xf6",e:5}],"-1#1328140860":[{m:"Rg3-g5",e:5}],"1#-688641575":[{m:"i5-i6",e:5}],"-1#-655491788":[{m:"Ee8-g10",e:5}],"1#464568779":[{m:"Eg1-i3",e:5}],"-1#-304938888":[{m:"Rg5-c5",e:5}],"1#451122293":[{m:"Ce3-g3",e:5}],"-1#-364442958":[{m:"Ec10-e8",e:5}],"1#-959116719":[{m:"Ec1-e3",e:5}],"-1#1949557880":[{m:"Cb6-e6",e:5}],"1#1768976854":[{m:"Ei3-g1",e:5}],"-1#-1626099611":[{m:"g6-g5",e:5}],"1#-427665710":[{m:"Rf6xe6",e:5}],"-1#-1323287017":[{m:"Rc5xc3",e:5}],"1#322008745":[{m:"Re6-f6",e:5}],"-1#988464310":[{m:"Rc3-c4",e:5}],"1#1433600890":[{m:"Ci7-i10",e:5}],"-1#2120237781":[{m:"Rb8-b6",e:5}],"1#433092643":[{m:"Rf6xb6",e:5}],"-1#302889430":[{m:"Hc8xb6",e:5}],"1#-421597225":[{m:"Rh8-g8",e:5}],"-1#-1403556288":[{m:"Ke10-d10",e:5}],"1#-710816967":[{m:"Rg8xg5",e:5}],"-1#-1795789977":[{m:"Rc4xe4",e:5}],"1#-1114558256":[{m:"i6-h6",e:5}],"-1#-1920488224":[{m:"Re4-d4",e:5}],"1#926378444":[{m:"Af1-e2",e:5}],"-1#1869513478":[{m:"Hb6-d5",e:5}],"1#-1342235791":[{m:"h6-h7",e:5}],"-1#-210156466":[{m:"Cf8-f6",e:5}],"1#821739594":[{m:"Rg5-f5",e:5}],"-1#1722578851":[{m:"Cf6-b6",e:5}],"1#199892074":[{m:"Ee3-c1",e:5}],"-1#-1190333885":[{m:"Cb6-e6+",e:5}],"1#1159843729":[{m:"Ke1-f1",e:5}],"-1#-1066745752":[{m:"Hd5-b4",e:5}],"1#-16187095":[{m:"Cg3-b3",e:5}],"-1#-1204797691":[{m:"Rd4-h4",e:5}],"1#-1987877955":[{m:"h7-g7",e:5}],"-1#-1360235445":[{m:"Rh4-g4",e:5}],"1#2101035344":[{m:"g7-f7",e:5}],"-1#-19010444":[{m:"Rg4xg1+",e:5}],"1#-1655202812":[{m:"Kf1-f2",e:5}],"-1#1033756867":[{m:"Ce6-c6",e:5}],"1#732484466":[{m:"Cb3-c3",e:5}],"-1#1041605570":[{m:"Hb10-c8",e:5}],"1#788902270":[{m:"Hh1-g3",e:5}],"-1#1622678710":[{m:"Ch8-d8",e:5}],"1#2001450363":[{m:"Hb1-a3",e:5}],"-1#1754597667":[{m:"Hh10-g8",e:5}],"1#-1437732242":[{m:"Ri1-h1",e:5}],"-1#-1596937890":[{m:"i7-i6",e:5}],"1#-1354930303":[{m:"Ch3-i3",e:5}],"-1#-662263650":[{m:"a7-a6",e:5}],"1#-593185380":[{m:"Ra1-a2",e:5}],"-1#1441086775":[{m:"Cb8-a8",e:5}],"1#-1662578953":[{m:"c4-c5",e:5}],"-1#1408512639":[{m:"c6xc5",e:5}],"1#1754063851":[{m:"Ra2-c2",e:5}],"-1#268179766":[{m:"Hc8-d6",e:5}],"1#625914549":[{m:"Rc2xc5",e:5}],"-1#-1691844906":[{m:"Ec10-e8",e:5}],"1#-1212514763":[{m:"Rh1-h6",e:5}],"-1#25373281":[{m:"g7-g6",e:5}],"1#1960434972":[{m:"i5xi6",e:5}],"-1#-1510490063":[{m:"Hg8xh6",e:5}],"1#-293023935":[{m:"Ci3xi10",e:5}],"-1#503474151":[{m:"Hh6-g8",e:5}],"1#-2083811480":[{m:"g5xg6",e:5}],"-1#-387541122":[{m:"Ee8xg6",e:5}],"1#-814017356":[{m:"Rc5-c6",e:5}],"-1#-346664694":[{m:"Hd6xe4",e:5}],"1#-371625689":[{m:"Hg3xe4",e:5}],"-1#-1044034735":[{m:"Cd8-e8",e:5}],"1#-1467833130":[{m:"Rc6xg6",e:5}],"-1#786906214":[{m:"Hg8-i9",e:5}],"1#1229579215":[{m:"Cb3-e3",e:5}],"-1#-485919659":[{m:"Ce8xe4+",e:5}],"1#-249714125":[{m:"Ce3xe7",e:5}],"-1#1454610285":[{m:"Ra10-c10",e:5}],"1#54560640":[{m:"Rg6-e6",e:5}],"-1#2040311235":[],"1#-2079221316":[{m:"Hb1-c3",e:8.333}],"-1#-699796751":[{m:"Hb10-c8",e:8.333}],"1#-950411187":[{m:"Hh1-i3",e:8.333},{m:"c4-c5",e:8.333},{m:"Ra1-b1",e:8.333}],"-1#-556277645":[{m:"Ra10-b10",e:6.667}],"1#-425341206":[{m:"Hi3-h5",e:6.667}],"-1#-2129316707":[{m:"Ch8-h6",e:6.667}],"1#-1159966817":[{m:"c4-c5",e:6.667},{m:"Hh5-f6",e:6.667}],"-1#1976529687":[{m:"Rb10-b6",e:5}],"1#115149441":[{m:"Ad1-e2",e:5}],"-1#1238637441":[{m:"Hh10-g8",e:5}],"1#-1962090292":[{m:"Ra1-b1",e:5}],"-1#-1113583568":[{m:"Ri10-i9",e:5}],"1#-66403244":[{m:"Ch3-g3",e:5}],"-1#-487270286":[{m:"c7-c6",e:5}],"1#563290953":[{m:"Hh5-f6",e:5}],"-1#-1161878856":[{m:"c6xc5",e:5}],"1#-2117602516":[{m:"Hf6xg8",e:5}],"-1#1018923425":[{m:"Ri9-i8",e:5}],"1#998863911":[{m:"Hg8xf10",e:5}],"-1#-1234632626":[{m:"Ke10xf10",e:5}],"1#-1540907113":[{m:"Cb3-a3",e:5}],"-1#-1749444869":[{m:"c5-c4",e:5}],"1#-1079894924":[{m:"Ri1-h1",e:5}],"-1#-1254144188":[{m:"Ch6-c6",e:5}],"1#351252656":[{m:"Rb1xb6",e:5}],"-1#1460220948":[{m:"Hc8xb6",e:5}],"1#-1545969131":[{m:"Rh1-h6",e:5}],"-1#367212097":[{m:"Ec10-a8",e:5}],"1#-1092039680":[{m:"Hc3-d1",e:5}],"-1#569396846":[{m:"g7-g6",e:5}],"1#1420474643":[{m:"Hf6xe8",e:5}],"-1#726528618":[{m:"Eg10xe8",e:5}],"1#1998650588":[{m:"Ra1-b1",e:5}],"-1#1099697184":[{m:"Hh10-g8",e:5}],"1#-2091583635":[{m:"Cb3-b5",e:5}],"-1#-1273124909":[{m:"c7-c6",e:5}],"1#2004507880":[{m:"Ch3-i3",e:5}],"-1#12686327":[{m:"Ch6-h3",e:5}],"1#-835297043":[{m:"i5-i6",e:5}],"-1#-1070615552":[{m:"Ri10-h10",e:5}],"1#-1704015375":[{m:"Ci3xi7",e:5}],"-1#-839841055":[{m:"Hg8-f6",e:5}],"1#1870716498":[{m:"Ri1-i5",e:5}],"-1#-1273365658":[{m:"Hf6xg4",e:5}],"1#1453847575":[{m:"Ri5-f5",e:5}],"-1#895741158":[{m:"Ch3-h1",e:5}],"1#-1911862853":[{m:"Ad1-e2",e:5}],"-1#-1056810821":[{m:"Ad10-e9",e:5}],"1#767778890":[{m:"Cb5-b7",e:5}],"-1#467373951":[{m:"Rh10-h3",e:5}],"-1#139123909":[{m:"Ra10-b10",e:7.5}],"1#809038428":[{m:"Cb3-b5",e:7.5}],"-1#124887778":[{m:"Hh10-g8",e:7.5},{m:"Ch8-f8",e:7.5}],"1#-978757201":[{m:"Hh1-g3",e:6.667}],"-1#-1978338201":[{m:"Ri10-i9",e:6.667}],"1#-876732413":[{m:"Ra1-b1",e:6.667},{m:"Eg1-e3",e:6.667}],"-1#-49098497":[{m:"Rb10-b6",e:5}],"1#-1912559255":[{m:"Eg1-e3",e:5}],"-1#144289723":[{m:"Rb10-b6",e:5}],"1#484343385":[{m:"Af1-e2",e:6.667},{m:"Ri1-g1",e:6.667}],"-1#1149736083":[{m:"Rf9-f4",e:5}],"1#721995280":[{m:"g4-g5",e:5}],"-1#1740845309":[{m:"g7-g6",e:5}],"1#312067968":[{m:"Ch3-h7",e:5}],"-1#1722505530":[{m:"c7-c6",e:5}],"1#-1513315839":[{m:"g5xg6",e:5}],"-1#2097354244":[{m:"c7-c6",e:5}],"1#-1100681921":[{m:"c5xc6",e:5}],"-1#-2114480405":[{m:"Rb6xc6",e:5}],"1#2001177020":[{m:"Cb5-g5",e:5}],"-1#-1160368888":[{m:"Rc6xc3",e:5}],"-1#1294411473":[{m:"Ri9-f9",e:5}],"1#1499526963":[{m:"Ra1-b1",e:5}],"-1#1875642319":[{m:"Rb10-b6",e:5}],"1#-999753525":[{m:"Hh1-g3",e:5}],"-1#-1948953341":[{m:"Hh10-g8",e:5}],"1#1225633358":[{m:"Ch3-h2",e:5}],"-1#369601511":[{m:"Rb10-b6",e:5}],"1#1695928945":[{m:"Ch2-c2",e:5}],"-1#1244142546":[{m:"Rb6-h6",e:5}],"1#287528427":[{m:"Eg1-e3",e:5}],"-1#-1749396679":[{m:"Rh6-h3",e:5}],
"1#-768294748":[{m:"Ri1-g1",e:5}],"-1#-1276532487":[{m:"g7-g6",e:5}],"1#-961323132":[{m:"Ra1-b1",e:5}],"-1#-266358920":[{m:"Hg8-f6",e:5}],"1#1382972363":[{m:"Af1-e2",e:5}],"-1#171413761":[{m:"Hf6xg4",e:5}],"1#-393634192":[{m:"Hc3-d5",e:5}],"-1#-1026924467":[{m:"i7-i6",e:5}],"1#-853037422":[{m:"c5-c6",e:5}],"-1#-1560512466":[{m:"c7xc6",e:5}],"1#814916738":[{m:"Hd5xe7",e:5}],"-1#-412742007":[{m:"i6xi5",e:5}],"1#-985910910":[{m:"He7xc8",e:5}],"-1#598450079":[{m:"Cf8xc8",e:5}],"-1#-235597647":[{m:"Ra10-b10",e:5}],"1#-913883608":[{m:"Hh1-g3",e:5}],"-1#-2042981408":[{m:"g7-g6",e:5}],"1#-211786595":[{m:"c4-c5",e:5}],"-1#1014192149":[{m:"Rb10-b4",e:5}],"1#-1051418124":[{m:"Eg1-e3",e:5}],"-1#1204660006":[{m:"Hh10-g8",e:5}],"1#-2062197653":[{m:"Ch3-h4",e:5}],"-1#1909577431":[{m:"Ch8-i8",e:5}],"1#1278260260":[{m:"g4-g5",e:5}],"-1#16466633":[{m:"Rb4-b6",e:5}],"1#-1827408433":[{m:"Ch4-g4",e:5}],"-1#249995209":[{m:"Ri10-h10",e:5}],"1#1420288568":[{m:"Cg4xg6",e:5}],"-1#1575035809":[{m:"Ce8-f8",e:5}],"1#1192928392":[{m:"Cb3-a3",e:5}],"-1#1954852324":[{m:"Rb6-d6",e:5}],"1#-1879521073":[{m:"Cg6-g7",e:5}],"-1#-1648984334":[{m:"c7-c6",e:5}],"1#1590789577":[{m:"Rb1-b7",e:5}],"-1#2114268778":[{m:"c6xc5",e:5}],"1#1165885438":[{m:"Rb7-c7",e:5}],"-1#-1079984624":[{m:"Eg10-e8",e:5}],"1#2096988911":[{m:"Rc7xc5",e:5}],"-1#-573435590":[{m:"i7-i6",e:5}],"1#-767565851":[{m:"Hg3-f5",e:5}],"-1#-2066903934":[{m:"Rd6-e6",e:5}],"1#1525351049":[{m:"Cg7xa7",e:5}],"-1#1949406792":[{m:"Re6-f6",e:5}],"1#1538087661":[{m:"Ca7-a5",e:5}],"-1#1052308364":[{m:"Ci8xi5",e:5}],"1#631753415":[{m:"g5-g6",e:5}],"-1#1202406868":[{m:"Rf6xg6",e:5}],"1#-379821296":[{m:"Rc5-c7",e:5}],"-1#-40187717":[{m:"Rg6-f6",e:5}],"1#1834830953":[{m:"Ca5xi5",e:5}],"-1#239134802":[{m:"Rf6xf5",e:5}],"1#-1190186323":[{m:"Ci5-i2",e:5}],"-1#1413723102":[{m:"Rh10-h6",e:5}],"1#-241956220":[{m:"Ri1-g1",e:5}],"-1#-1874238759":[{m:"Hg8-f6",e:5}],"1#842577514":[{m:"Ci2-c2",e:5}],"-1#894935954":[{m:"Rh6-h9",e:5}],"1#-2004885837":[{m:"Ad1-e2",e:5}],"-1#-948514893":[{m:"Rh9-b9",e:5}],"1#-2063491182":[{m:"Cc2-d2",e:5}],"-1#1508546417":[{m:"Af10-e9",e:5}],"1#1430344675":[{m:"Rg1-h1",e:5}],"-1#1218414680":[{m:"g7-g6",e:8.571},{m:"c7-c6",e:8.571},{m:"Hh10-i8",e:8.571}],"1#1036353317":[{m:"g4-g5",e:5}],"-1#1896778184":[{m:"Eg10-e8",e:5}],"1#-1303136969":[{m:"g5xg6",e:5}],"-1#-646009567":[{m:"Ee8xg6",e:5}],"1#-1899633026":[{m:"Hb1-c3",e:5}],"-1#-593654477":[{m:"Hb10-c8",e:5}],"1#-846356593":[{m:"Ra1-b1",e:5}],"-1#-81694861":[{m:"Ra10-b10",e:5}],"1#-1017953814":[{m:"Rb1-b5",e:5}],"-1#-1677888559":[{m:"Eg6-e8",e:5}],"1#-227108200":[{m:"Eg1-e3",e:5}],"-1#1961860170":[{m:"Cb8-a8",e:5}],"1#-1108496502":[{m:"Rb5-f5",e:5}],"-1#838247121":[{m:"Rb10-b6",e:5}],"1#1122294599":[{m:"Hh1-f2",e:5}],"-1#1957763542":[{m:"Hh10-g8",e:5}],"1#-1234574693":[{m:"Rf5-g5",e:5}],"-1#191019428":[{m:"Hg8-f6",e:5}],"1#-1458344681":[{m:"Ch3-h6",e:5}],"-1#-817719749":[{m:"Hf6xe4",e:5}],"1#-1038694256":[{m:"Hf2xe4",e:5}],"-1#1863650450":[{m:"Rb6xh6",e:5}],"1#-1050130290":[{m:"c4-c5",e:5}],"-1#242971654":[{m:"Af10-e9",e:5}],"1#47231124":[{m:"Hc3-d5",e:5}],"-1#680742569":[{m:"c7-c6",e:5}],"1#-336284270":[{m:"c5xc6",e:5}],"-1#-731394490":[{m:"Ee8xc6",e:5}],"1#-1094952266":[{m:"Af1-e2",e:5}],"-1#-421154692":[{m:"Ec10-e8",e:5}],"1#-898125665":[{m:"Ri1-f1",e:5}],"-1#-415553451":[{m:"Ri10-f10",e:5}],"1#1861197713":[{m:"Hd5-f6",e:5}],"-1#-940383195":[{m:"e7-e6",e:5}],"1#1696633170":[{m:"Cg3-f3",e:5}],"-1#1521145696":[{m:"Rf10-g10",e:5}],"1#1763422108":[{m:"Hf6-g8",e:5}],"-1#-589173745":[{m:"Rh6-g6",e:5}],"1#501940577":[{m:"Rg5xg6",e:5}],"-1#-589028547":[{m:"Ee8xg6",e:5}],"1#-2092641008":[{m:"Hg8-h6",e:5}],"-1#436393287":[{m:"e6-e5",e:5}],"1#-155004429":[{m:"Cf3-g3",e:5}],"-1#-917989439":[{m:"Ch8-g8",e:5}],"1#-1078740725":[{m:"Cg3xg8",e:5}],"-1#1437319946":[{m:"Ca8xg8",e:5}],"1#661607509":[{m:"He4-c3",e:5}],"-1#730650736":[{m:"Cg8-e8",e:5}],"1#182624912":[{m:"Hh6-g4",e:5}],"-1#161528819":[{m:"Rg10-g7",e:5}],"1#-1928241257":[{m:"Hg4xe5",e:5}],"-1#-743160183":[{m:"Hc8-e7",e:5}],"1#-577543523":[{m:"Rf1-f7",e:5}],"-1#1873665987":[],"1#-1946651805":[{m:"Hb1-c3",e:8},{m:"Hh1-i3",e:8}],"-1#-643819474":[{m:"Hb10-c8",e:7.5},{m:"Cb8-d8",e:7.5}],"1#-927987054":[{m:"Ra1-b1",e:6.667},{m:"Eg1-e3",e:6.667}],"-1#-31655314":[{m:"Ra10-b10",e:5}],"1#-965815049":[{m:"Rb1-b5",e:5}],"-1#-1631525172":[{m:"Cb8-a8",e:5}],"1#1472386316":[{m:"Rb5-d5",e:5}],"-1#2110001998":[{m:"Hh10-i8",e:5}],"1#-172022606":[{m:"i4-i5",e:5}],"-1#1268792530":[{m:"Ri10-i9",e:5}],"1#168487094":[{m:"Af1-e2",e:5}],"-1#1381171836":[{m:"Ri9-f9",e:5}],"1#1175770014":[{m:"Eg1-e3",e:5}],"-1#-1064446644":[{m:"Rb10-b4",e:5}],"1#1034562733":[{m:"Cg3-f3",e:5}],"-1#35678879":[{m:"Rb4xc4",e:5}],"1#1715241592":[{m:"Hh1-i3",e:5}],"-1#2142405190":[{m:"c6-c5",e:5}],"1#-241653721":[{m:"Rd5-e5",e:5}],"-1#1311312960":[{m:"Eg10-e8",e:5}],"1#-1921765185":[{m:"Ra1-b1",e:5}],"-1#-1143422909":[{m:"Hc8-d6",e:5}],"1#-1855296576":[{m:"Rb1-b5",e:5}],"-1#-909878789":[{m:"Cb8-d8",e:5}],"1#-1534997240":[{m:"c4-c5",e:5}],"-1#1804792192":[{m:"c6xc5",e:5}],"1#1357520916":[{m:"Rb5xc5",e:5}],"-1#1858034886":[{m:"Ra10-a9",e:5}],"1#1994835335":[{m:"Af1-e2",e:5}],"-1#784281421":[{m:"Ra9-f9",e:5}],"1#-374790205":[{m:"Hh1-i3",e:5}],"-1#-265869315":[{m:"Rf9-f2",e:5}],"1#-1327393710":[{m:"Cg3-g2",e:5}],"-1#383362470":[{m:"Hh10-f9",e:5}],"1#-507983707":[{m:"Ch3-h2",e:7.5}],"-1#-1095578356":[{m:"Rf2-f7",e:7.5}],"1#-1260024611":[{m:"Ra1-a2",e:5}],"-1#1034159222":[{m:"Eg10-e8",e:5}],"1#-17221495":[{m:"Hh1-i3",e:5}],"-1#-411617097":[{m:"Hb10-c8",e:5}],"1#-161011189":[{m:"Ra2-d2",e:5}],"-1#576972849":[{m:"Af10-e9",e:5}],"1#784870563":[{m:"Cg3xg7",e:5}],"-1#-1312331767":[{m:"Hh10-g8",e:5}],"1#1931449156":[{m:"Rd2-d5",e:5}],"-1#1784601936":[{m:"Ra10-b10",e:5}],"1#1378677705":[{m:"Ch3-g3",e:5}],"-1#1288892399":[{m:"Ch8-h6",e:5}],"1#1998296301":[{m:"Ri1-h1",e:5}],"-1#2105987037":[{m:"Ch6-d6",e:5}],"1#2126143046":[{m:"Rd5-f5",e:5}],"-1#-981818834":[{m:"Rb10-b4",e:5}],"1#945642447":[{m:"c4-c5",e:5}],"-1#-145856697":[{m:"Cd6-e6+",e:5}],"1#1133982361":[{m:"Af1-e2",e:5}],"-1#466540627":[{m:"Hc8-d6",e:5}],"1#830239696":[{m:"e4-e5",e:5}],"-1#-1225550180":[{m:"Ce6-i6",e:5}],"1#-1019890943":[{m:"e5-e6",e:5}],"-1#1238910124":[{m:"e7xe6",e:5}],"1#-1420835978":[{m:"g4-g5",e:5}],"-1#-410765925":[{m:"Ci6xi3",e:5}],"1#388208245":[{m:"Eg1xi3",e:5}],"-1#1262241864":[{m:"Rb4-c4",e:5}],"1#1220300963":[{m:"c5xc6",e:5}],"-1#1999580023":[{m:"Rc4xc6",e:5}],"1#301439949":[{m:"Hc3-b5",e:5}],"-1#1490384289":[{m:"Rc6-b6",e:5}],"1#-9679519":[{m:"Hb5xd6",e:5}],"-1#1514905615":[{m:"Rb6xd6",e:5}],"1#-443120055":[{m:"Rf5-f6",e:5}],"-1#1690684169":[{m:"Ri10-f10",e:5}],"-1#-1837730979":[{m:"Hb10-c8",e:5}],"1#-2090442271":[{m:"Ri1-i2",e:5}],"-1#-702403191":[{m:"Ch8-e8",e:5}],"1#-1253352270":[{m:"Hb1-c3",e:5}],"-1#-418170881":[{m:"Hh10-g8",e:5}],"1#634113202":[{m:"i4-i5",e:5}],"-1#-1680550702":[{m:"Ri10-h10",e:5}],"1#-1047156445":[{m:"Ch3-h5",e:5}],"-1#-1312102624":[{m:"Rh10-h6",e:5}],"1#337469050":[{m:"Ec1-e3",e:5}],"-1#-1493454765":[{m:"Ra10-b10",e:5}],"1#-1635148086":[{m:"g4-g5",e:5}],"-1#-767399897":[{m:"Cb8-b4",e:5}],"1#1871651107":[{m:"c4-c5",e:5}],"-1#-1600381525":[{m:"c6xc5",e:5}],"1#-1679504321":[{m:"Ch5xc5",e:5}],"-1#1289808738":[{m:"Hc8-d6",e:5}],"1#1716666593":[{m:"Ri2-d2",e:5}],"-1#-931140606":[{m:"Hd6-f5",e:5}],"1#1868733871":[{m:"Cg3-f3",e:5}],"-1#1357437853":[{m:"Cb4-d4",e:5}],"1#1462541941":[{m:"Cc5-e5",e:5}],"-1#1878476092":[{m:"e7-e6",e:5}],"1#-853200821":[{m:"Ce5xe8",e:5}],"-1#28571949":[{m:"Eg10xe8",e:5}],"1#-310289295":[{m:"Ra1-b1",e:5}],"-1#-617763699":[{m:"Rb10xb1",e:5}],"1#385996636":[{m:"Hc3xb1",e:5}],"-1#-1898279693":[{m:"Rh6-h4",e:5}],"1#-225317489":[{m:"Hb1-c3",e:5}],"-1#-1597405502":[{m:"Hg8-e7",e:5}],"1#1486167779":[{m:"Ad1-e2",e:5}],"-1#396103651":[{m:"He7-c6",e:5}],"1#1012753438":[{m:"Rd2-b2",e:5}],"-1#2004114663":[{m:"Cd4-d8",e:5}],"1#-1606892296":[{m:"Rb2-b7",e:5}],"-1#-2020328566":[{m:"Ad10-e9",e:5}],"1#1800733563":[{m:"Rb7-d7",e:5}],"-1#-2056341891":[{m:"Hc6-b4",e:5}],"1#782421372":[{m:"Ee3-c5",e:7.5},{m:"Hi3-g2",e:7.5}],"-1#147417133":[{m:"Rh4-i4",e:5}],"1#2000777109":[{m:"Cf3-f2",e:5}],"-1#1776214837":[{m:"Ri4xi5",e:5}],"1#-1942791869":[{m:"Rd7-b7",e:5}],"-1#1644751941":[{m:"Hb4-c6",e:5}],"1#-909863100":[{m:"Cf2-h2",e:5}],"-1#1718783756":[{m:"Ri5xg5",e:5}],"1#37474787":[{m:"Eg1-e3",e:5}],"-1#-2069702863":[{m:"Rg5-g6",e:5}],"1#-1825613361":[{m:"Rb7-f7",e:5}],"-1#-2039714774":[{m:"Rg6-h6",e:5}],"1#339523039":[{m:"Hi3-g4",e:5}],"-1#43391629":[{m:"Rh6-h5",e:5}],"1#378446590":[{m:"Ae2-f3",e:5}],"-1#1436032327":[{m:"Cd8-d4",e:5}],"1#-2100001448":[{m:"Ch2-f2",e:5}],"-1#761437456":[{m:"Hf5-h4",e:5}],"1#-1657190983":[{m:"Rf7xg7",e:5}],"-1#-1032288383":[{m:"Rh5xc5",e:5}],"1#-114632019":[{m:"Hc3-a2",e:5}],"-1#-1581339043":[{m:"Rc5-c4",e:5}],"1#-267705786":[{m:"Hg4-f6",e:5}],"-1#440235666":[{m:"Cd4xa4",e:5}],"1#-1596577558":[{m:"Af1-e2",e:5}],"-1#-124796384":[{m:"Rc4-d4",e:5}],"1#-1947039864":[{m:"Rg7xi7",e:5}],"-1#-1032704044":[],"-1#1529991840":[{m:"Rh4-g4",e:6.667}],"1#-1998133317":[{m:"Hg2-i3",e:7.5}],"-1#-42600345":[{m:"Hc6-b4",e:5},{m:"Rg4-i4",e:7.5}],"1#1291320757":[{m:"Hi3-g2",e:5}],"-1#962912873":[{m:"Rh4-g4",e:6.667}],"1#-1058750556":[{m:"Hb1-c3",e:5}],"-1#-1833118487":[{m:"Hb10-c8",e:5}],"1#-2085829035":[{m:"Ra1-b1",e:5}],"-1#-1258277207":[{m:"Ra10-b10",e:5}],"1#-1921902544":[{m:"c4-c5",e:5}],"-1#1113662648":[{m:"Ri10-i9",e:5}],"1#63697116":[{m:"Eg1-e3",e:5}],"-1#-2058160626":[{m:"Ri9-f9",e:5}],"1#-1860884500":[{m:"i4-i5",e:5}],"-1#789200780":[{m:"Rf9-f4",e:5}],"1#1082486031":[{m:"Cg3-g1",e:5}],"-1#68966128":[{m:"Ec10-e8",e:5}],"1#680416787":[{m:"Hh1-g3",e:5}],"-1#1731460059":[{m:"Cb8-b3",e:5}],"1#1240062739":[{m:"g4-g5",e:5}],"-1#86126078":[{m:"Ch8-g8",e:5}],"1#1943601972":[{m:"Ch3-i3",e:5}],"-1#73583659":[{m:"g7-g6",e:5}],"1#1899510614":[{m:"Hg3-h5",e:5}],"-1#1086024919":[{m:"Rf4-h4",e:5}],"1#-455497356":[{m:"Hh5xi7",e:5}],"-1#153652344":[{m:"Cg8-g9",e:5}],"1#1198372222":[{m:"g5xg6",e:5}],"-1#742436200":[{m:"Rh4-i4",e:5}],"1#1405659856":[{m:"Cg1xg9",e:5}],"-1#-1276936371":[{m:"Hi8xg9",e:5}],"1#610192472":[{m:"Hi7-h5",e:5}],"-1#78174522":[{m:"Ee8xg6",e:5}],"1#590699248":[{m:"Ri1-h1",e:5}],"-1#698876352":[{m:"Hg9-h7",e:5}],"1#719453952":[{m:"Ci3-g3",e:5}],"-1#1584995144":[{m:"Hh7-f8",e:5}],"1#-358825086":[{m:"Hh5-f6",e:5}],"-1#1907409523":[{m:"Ri4xi5",e:5}],"1#-1805813755":[{m:"Hf6-d7",e:5}],"-1#-1421123642":[{m:"Rb10-b9",e:5}],"1#-199442406":[{m:"Rh1-h8",e:5}],"-1#635348079":[{m:"Ri5-f5",e:5}],"1#-239889231":[{m:"Cg3xg10+",e:5}],"-1#797819800":[{m:"Hf8xg10",e:5}],"1#753868873":[{m:"Rh8xc8",e:5}],"-1#-1470759192":[{m:"Af10-e9",e:5}],"1#-1526842758":[{m:"Rc8xc7",e:5}],"-1#-875694949":[{m:"Hg10-f8",e:5}],"1#-20978548":[{m:"Ad1-e2",e:5}],"-1#-1313409652":[{m:"Ke10-f10",e:5}],"1#-855715458":[{m:"Rc7xa7",e:5}],"-1#2142400803":[{m:"Rf5-f6",e:5}],"1#-1208727788":[{m:"Hd7-e5",e:5}],"-1#-538388090":[{m:"e7-e6",e:5}],"1#2100997361":[{m:"He5-g4",e:5}],"-1#-1073331852":[{m:"Rf6-f4",e:5}],"1#113624102":[{m:"Hg4-i5",e:5}],"-1#-1603321474":[{m:"Rf4-i4",e:5}],"1#1717089300":[{m:"Ra7-i7",e:5}],"-1#2143655676":[{m:"Eg6-e8",e:5}],"1#1718138656":[{m:"Hc3-d5",e:5}],"-1#1277905181":[{m:"Ee8-g10",e:5}],"1#-619583255":[{m:"Hi5-g6",e:5}],"-1#-1984901955":[{m:"Ri4xi7",e:5}],"1#-13970432":[{m:"Hg6xi7",e:5}],"-1#-570206750":[{m:"Rb9-b7",e:5}],"1#1729861009":[{m:"Hi7-h5",e:5}],"-1#1206747379":[{m:"Hf8-d7",e:5}],"1#1277628447":[{m:"c5-c6",e:5}],"-1#603768483":[{m:"Rb7-b5",e:5}],"1#-349447012":[{m:"Hh5-g7",e:5}],"-1#-1356983880":[{m:"Rb5xd5",e:5}],"1#-1776925790":[{m:"Rb1xb3",e:5}],"-1#1643427434":[{m:"Rd5-d4",e:5}],"1#1003219685":[{m:"a4-a5",e:5}],"-1#363155369":[{m:"Rd4xe4",e:5}],"1#-1418999286":[{m:"a5-a6",e:5}],"-1#168041238":[{m:"Hd7-f8",e:5}],"1#30313466":[{m:"Rb3-b7",e:5}],"-1#1458768658":[{m:"e6-e5",e:5}],"1#-1171058778":[{m:"Hg7-h5",e:5}],"-1#-33111422":[{m:"Re4-h4",e:5}],"1#-192637746":[{m:"Hh5-f6",e:5}],"-1#1873319231":[{m:"Rh4-f4",e:5}],"1#-178335144":[{m:"Hf6-g8+",e:5}],"-1#770101451":[{m:"Kf10-e10",e:5}],"1#1353643065":[{m:"a6-b6",e:5}],"-1#520968626":[{m:"Rf4-g4",e:5}],"1#-342175291":[{m:"Hg8-f6",e:5}],"-1#857920342":[{m:"Rg4-f4",e:5}],"1#-944415967":[{m:"Hf6-h5",e:5}],"-1#1553554128":[{m:"Rf4-h4",e:5}],"1#-965796425":[{m:"Hh5-f6",e:5}],"-1#1564679238":[{m:"Rh4-h6",e:5}],"1#-944725483":[{m:"Rb7-f7",e:5}],"-1#119209766":[{m:"Rh6-g6",e:5}],"1#-972025272":[{m:"c6-c7",e:5}],"-1#-1468871428":[{m:"Rg6-h6",e:5}],"1#1769480594":[{m:"Ee3-g5",e:5}],"-1#653235575":[{m:"Rh6-h4",e:5}],"1#-1139004636":[{m:"Rf7-e7",e:5}],"-1#1070692268":[{m:"Rh4-f4",e:5}],"1#-1524158261":[{m:"Hf6-g8",e:5}],"-1#2107585112":[{m:"Rf4-c4",e:5}],"1#-1225184584":[{m:"b6-b7",e:5}],"-1#1547734653":[{m:"Rc4xc1+",e:5}],"1#-286351145":[{m:"Ae2-d1",e:5}],"-1#-1578651177":[{m:"e5-d5",e:5}],"1#698646443":[{m:"Hg8-f6",e:5}],"-1#-249791176":[{m:"d5-d4",e:5}],"1#1139976739":[{m:"Re7-f7",e:5}],"-1#-1069549909":[{m:"Rc1-c5",e:5}],"1#-901361136":[{m:"Rf7-g7",e:5}],"-1#1348687356":[{m:"Rc5-e5+",e:5}],"1#216201221":[{m:"Af1-e2",e:5}],"-1#1421546191":[{m:"Re5-e6",e:6.667},{m:"Re5-f5",e:6.667}],"1#-785896518":[{m:"Rg7-f7",e:5}],"-1#1259154518":[{m:"Re6-e5",e:5}],"1#-828500701":[{m:"Af1-e2",e:5}],"1#-740966571":[{m:"Hf6-d7",e:5}],"-1#-322725738":[{m:"Hf8xd7",e:5}],"1#-1100175333":[{m:"c7xd7",e:5}],"-1#1394479196":[{m:"Eg10-i8",e:5}],"1#1837246548":[{m:"Rg7-i7",e:5}],"-1#-1939510833":[{m:"Rf5-f8",e:5}],"1#596370552":[{m:"Ri7-i4",e:5}],"-1#454666636":[{m:"Rf8-g8",e:5}],"1#1684539148":[{m:"Eg5-i3",e:5}],"-1#1527084168":[{m:"Ei8-g10",e:5}],"1#1704545408":[{m:"Ri4xd4",e:5}],"-1#-449193168":[{m:"Eg10-i8",e:5}],"1#-609885384":[{m:"b7-c7",e:5}],"-1#-2141323073":[{m:"Ei8-g10",e:5}],"1#-1094567753":[{m:"d7-e7",e:5}],"-1#-725400374":[{m:"Ke10-f10",e:5}],"1#-1450483656":[{m:"e7-f7",e:5}],"-1#-1157512745":[{m:"Kf10-e10",e:5}],"1#-968235739":[{m:"Rd4-c4",e:5}],"-1#1031686596":[{m:"Rg8-d8",e:5}],"1#-322869786":[{m:"f7-g7",e:5}],"-1#-717540091":[{m:"Ae9-f10",e:5}],"1#-644812393":[{m:"c7-c8",e:5}],"-1#-1049781325":[{m:"Rd8-e8",e:5}],"1#850254870":[{m:"c8-c9",e:5}],"-1#-270829888":[{m:"Re8-e9",e:5}],"1#-826215161":[{m:"g7-f7",e:5}],"-1#-147151388":[{m:"Re9-h9",e:5}],"1#617703637":[{m:"Ei3-g1",e:5}],"-1#-760043162":[{m:"Rh9-f9",e:5}],"1#2096570718":[{m:"Rc4-c7",e:5}],"-1#-1386460975":[{m:"Eg10-i8",e:5}],"1#-1816104743":[{m:"Eg1-e3",e:5}],"-1#358184459":[{m:"Ei8-g10",e:5}],"-1#1131233433":[{m:"Hh10-i8",e:9.994},{m:"Ch8-d8",e:9.994},{m:"Hb10-c8",e:9.994},{m:"Ch8-e8",e:9.994},{m:"Cb8-d8",e:9.994},{m:"c7-c6",e:9.994},{m:"Cb8-g8",e:9.994},{m:"Cb8-e8",e:9.994},{m:"Cb8-f8",e:9.994},{m:"Hb10-a8",e:9.994},{m:"Ch8-g8",e:9.994},{m:"Af10-e9",e:9.994},{m:"Eg10-e8",e:9.994},{m:"Hh10-g8",e:9.994},{m:"g7-g6",e:9.994},{m:"Ec10-e8",e:9.994}],"1#-887720091":[{m:"Hh1-g3",e:6.667}],"-1#-2069112147":[{m:"Ri10-i9",e:6.667}],"1#-989786423":[{m:"Eg1-e3",e:6.667},{m:"Ec1-e3",e:6.667}],"-1#1134037019":[{m:"c7-c6",e:5}],"1#-2130709728":[{m:"Cb3-c3",e:5}],"-1#-1978150855":[{m:"Ec10-e8",e:5}],"1#-1501179686":[{m:"Hb1-a3",e:5}],"-1#-1185190782":[{m:"Hb10-c8",e:5}],"1#-1471447490":[{m:"Ra1-b1",e:5}],"-1#-1628991806":[{m:"Ra10-b10",e:5}],"1#-1500143525":[{m:"Rb1-b5",e:9.667},{m:"Ch3-i3",e:9.667},{m:"i4-i5",e:9.667},{m:"Af1-e2",e:9.667}],"-1#-29650336":[{m:"Ri9-d9",e:8.571}],"-1#2011685088":[{m:"Ri9-f9",e:5}],"1#1671442690":[{m:"i4-i5",e:5}],"-1#-574674590":[{m:"Ec10-e8",e:5}],"1#-248698495":[{m:"Hb1-c3",e:5}],"-1#-1552596276":[{m:"c7-c6",e:5}],"1#1611839991":[{m:"i5-i6",e:5}],"-1#1846242586":[{m:"i7xi6",e:5}],"1#803519849":[{m:"Ri1xi6",e:5}],"-1#-2041364763":[{m:"Ch8-g8",e:5}],"1#-257421265":[{m:"Ch3-i3",e:5}],"-1#-2028740816":[{m:"Cg8-g9",e:5}],"1#-917051850":[{m:"Hg3-h5",e:5}],"1#1419700564":[{m:"Eg1-e3",e:8.571},{m:"Hh1-g3",e:8.571},{m:"Ch3-e3",e:8.571}],"-1#455296156":[{m:"Hh10-g8",e:8}],"1#-637812783":[{m:"g4-g5",e:6.667},{m:"Hg3-h5",e:8}],"-1#-748231455":[{m:"c7-c6",e:8.333},{m:"Ri10-h10",e:8.333},{m:"Ri10-i9",e:8.333}],"1#268509146":[{m:"Hb1-a3",e:6.667},{m:"Cb3-c3",e:6.667}],"-1#266314626":[{m:"Hb10-c8",e:5}],"1#516927806":[{m:"Ra1-a2",e:5}],"-1#-1752286827":[{m:"Cb8-b6",e:5}],"-1#451493059":[{m:"Cb8-b3",e:5}],"1#875764747":[{m:"Eg1-e3",e:5}],"-1#-1297474855":[{m:"Hb10-a8",e:5}],"1#-130196773":[{m:"Hb1-a3",e:5}],"1#-1993893616":[{m:"Ch3-h7",e:5}],"-1#-48953430":[{m:"Ad10-e9",e:5}],"1#299122523":[{m:"Cb3-e3",e:5}],"-1#-1147885375":[{m:"Ec10-e8",e:5}],"1#-1761171422":[{m:"Hb1-c3",e:5}],"-1#-983645329":[{m:"c7-c6",e:5}],"1#104413268":[{m:"Ra1-b1",e:5}],"-1#815122600":[{m:"Hb10-c8",e:5}],"1#562420244":[{m:"Rb1-b7",e:5}],"1#-1832111995":[{m:"Hb1-a3",e:6.667},{m:"Hb1-c3",e:6.667}],"-1#-1928164131":[{m:"a7-a6",e:5}],"1#-1993305633":[{m:"Ra1-a2",e:5}],"-1#7412084":[{m:"Ri9-f9",e:5}],"1#339134614":[{m:"Ra2-d2",e:5}],"-1#-1064019000":[{m:"c7-c6",e:5}],"1#66298099":[{m:"Ra1-a2",e:5}],"-1#-1968035752":[{m:"Ri9-c9",e:5}],"-1#-394729392":[{m:"c7-c6",e:5}],"1#723456875":[{m:"Ri1-i2",e:5}],"-1#2119917315":[{m:"Eg10-e8",e:5}],"1#-1123654660":[{m:"Ec1-e3",e:5}],"-1#266374613":[{m:"Af10-e9",e:5}],"1#55265607":[{m:"Ri2-d2",e:5}],"-1#235495600":[{m:"Hh10-g8",e:5}],"1#-858678275":[{m:"Ri1-i2",e:5}],"-1#-1718233195":[{m:"Ri10-h10",e:5}],"1#-1009472924":[{m:"Hh1-g3",e:5}],"-1#-1939273812":[{m:"Rh10-h6",e:5}],"1#700366582":[{m:"Ri2-d2",e:5}],"-1#-2020404715":[{m:"Af10-e9",e:5}],"1#-1959209337":[{m:"Hg3-f5",e:5}],"-1#-573930016":[{m:"Rh6-f6",e:5}],"1#1383944741":[{m:"Hb1-c3",e:9.942},{m:"Cb3-c3",e:9.942},{m:"c4-c5",e:9.942},{m:"Eg1-e3",e:9.942},{m:"g4-g5",e:9.986},{m:"Ch3-f3",e:9.942},{m:"Ch3-g3",e:9.942},{m:"g4-g5",e:9.583},{m:"g4-g5",e:9.998}],"-1#1486188860":[{m:"Ra10-b10",e:5}],"1#1625776037":[{m:"Ch3-e3",e:5}],"-1#980473409":[{m:"Ch8-e8",e:5}],"1#1494853498":[{m:"Hh1-g3",e:5}],"-1#-1653707091":[{m:"Ch8-e8",e:9.885},{m:"Eg10-e8",e:9.885},{m:"Ra10-a9",e:9.885},{m:"Cb8-a8",e:9.885}],"-1#1998652572":[{m:"Ch8-f8",e:8.571},{m:"c7-c6",e:8.571},{m:"Ri10-i9",e:8.571}],"1#915132664":[{m:"Hh1-g3",e:7.5}],"-1#1283673603":[{m:"Hh10-i8",e:5}],"1#-990348801":[{m:"Hh1-i3",e:5}],"-1#-579438143":[{m:"Ri10-i9",e:5}],"1#-1663259227":[{m:"Ri1-h1",e:5}],"-1#499187693":[{m:"Ec10-e8",e:9.853},{m:"Hh10-i8",e:9.853},{m:"Hb10-c8",e:9.962},{m:"Eg10-e8",e:9.853},{m:"Ad10-e9",e:9.853}],"-1#149609409":[{m:"Cb8-a8",e:9.722},{m:"Ch8-f8",e:9.722},{m:"Eg10-e8",e:9.722},{m:"Hh10-i8",e:9.722}],"1#537145762":[{m:"g4-g5",e:8.333}],"-1#1874435178":[{m:"Hh10-g8",e:9.091},{m:"c7-c6",e:9.091}],"1#-1386125529":[{m:"c4-c5",e:9},{m:"Ec1-e3",e:9},{m:"Ri1-h1",e:9},{m:"Hh1-g3",e:5},{m:"Cb3-b5",e:9}],"-1#1651661743":[{m:"Hb10-a8",e:6.667},{m:"Ri10-i9",e:6.667}],"-1#528976142":[{m:"Ri10-h10",e:5}],"-1#-1476641769":[{m:"Ri10-i9",e:8.333},{m:"Hh10-g8",e:5}],"1#1687930668":[{m:"Cb3-e3",e:6.667},{m:"Hb1-c3",e:6.667}],"-1#-824487754":[{m:"Hb10-c8",e:5}],"-1#918793313":[{m:"Hb10-c8",e:6.667}],"-1#-1708640359":[{m:"c7-c6",e:5}],"1#1498401954":[{m:"Hb1-c3",e:5}],"1#-1394710703":[{m:"Cb3-d3",e:6.667},{m:"Ri1-h1",e:6.667}],"-1#-1777456982":[{m:"Ri10-i9",e:5}],"1#-677053234":[{m:"Hb1-c3",e:5}],"-1#-2047043709":[{m:"Ri9-d9",e:5}],"1#2063089212":[{m:"Ra1-a2",e:5}],"-1#-205932905":[{m:"Hh10-g8",e:5}],"-1#-1505543071":[{m:"Hh10-g8",e:5}],"1#774427754":[{m:"c4-c5",e:5}],"-1#-516167454":[{m:"Hb10-a8",e:5}],"1#-1414747936":[{m:"Hb1-c3",e:5}],"-1#-101399635":[{m:"Hh10-g8",e:5}],"1#992753888":[{m:"Ra1-b1",e:5}],"-1#226543644":[{m:"Ri10-i9",e:5}],"1#1277828216":[{m:"Cb3-b8",e:5}],"-1#1153880201":[{m:"Eg10-e8",e:5}],"1#-2019824522":[{m:"Ch3-g3",e:5}],"-1#-1721372592":[{m:"c7-c6",e:5}],"1#1510083435":[{m:"c5xc6",e:5}],"-1#1704030399":[{m:"Ri9-c9",e:5}],"1#890546932":[{m:"g5-g6",e:5}],"-1#1461200359":[{m:"Rc9xc6",e:5}],"1#519510245":[{m:"g6xg7",e:5}],"-1#590215646":[{m:"Hg8-e9",e:5}],"1#2114374044":[{m:"Eg1-e3",e:5}],"-1#-123744434":[{m:"Ra10-b10",e:5}],"1#-1058151977":[{m:"Hh1-f2",e:5}],"-1#-155704506":[{m:"Rc6-g6",e:5}],"1#-1888870957":[{m:"Cg3-g5",e:5}],"-1#-1561976195":[{m:"Rg6xg7",e:5}],"1#-1816657829":[{m:"Ri1-h1",e:5}],"-1#-1725605013":[{m:"Rg7-f7",e:5}],"1#1678562275":[{m:"Hf2-g4",e:5}],"-1#1568521758":[{m:"Ch8-g8",e:5}],"1#730239188":[{m:"Cg5-a5",e:5}],"1#-2146780254":[{m:"Eg1-e3",e:9.981},{m:"Ch3-e3",e:9.981},{m:"Ch3-h5",e:9.981},{m:"Ch3-f3",e:9.981},{m:"g4-g5",e:9.994},{m:"g4-g5",e:9.773},{m:"Cb3-c3",e:9.981},{m:"Hb1-a3",e:9.981},{m:"Cb3-e3",e:9.981},{m:"g4-g5",e:9.722},{m:"c4-c5",e:9.981},{m:"Ch3-c3",e:9.981}],"-1#-627232186":[{m:"Hb10-c8",e:9.831},{m:"c7-c6",e:9.993}],"-1#-262802015":[{m:"Hb10-c8",e:5}],"1#-515512547":[{m:"c4-c5",e:5}],"-1#-1521029861":[{m:"Hh10-i8",e:8.571},{m:"Cb8-e8",e:8.571},{m:"Ch8-c8",e:8.571},{m:"c7-c6",e:8.571}],"1#-1862346061":[{m:"Hb1-c3",e:5}],"-1#854349195":[{m:"Ec10-e8",e:9.412},{m:"Eg10-e8",e:9.412}],"-1#-1964861253":[{m:"Hb10-a8",e:9.953},{m:"Ec10-e8",e:9.953}],"-1#-1613494278":[{m:"c7-c6",e:9.091}],"-1#709504056":[{m:"c7-c6",e:9.412},{m:"c7-c6",e:9.722}],"-1#-810084758":[{m:"Hb10-c8",e:9.962},{m:"Eg10-e8",e:9.962},{m:"c7-c6",e:9.286},{m:"c7-c6",e:9.091},{m:"c7-c6",e:9.333}],"1#-98623038":[{m:"Cb3-d3",e:6.667},{m:"Ec1-e3",e:6.667}],"-1#-1060147655":[{m:"Hb10-c8",e:5}],"-1#1327073066":[{m:"c6xc5",e:6.667}],"1#1952536254":[{m:"Ec1-e3",e:6.667}],"-1#-1123967932":[{m:"Ec10-e8",e:6.667}],"1#-1852597081":[{m:"Ri1-i3",e:6.667}],"1#1249262240":[{m:"Cb3-e3",e:9.375},{m:"Ec1-e3",e:9.375},{m:"Eg1-e3",e:9.375},{m:"Hh1-i3",e:9.375},{m:"Hh1-g3",e:9.375}],"-1#-533287622":[{m:"Hb10-c8",e:7.5}],"1#-249118842":[{m:"Hh1-g3",e:7.5},{m:"Hb1-c3",e:7.5}],"-1#-1097133490":[{m:"g7-g6",e:5}],"-1#-124726135":[{m:"Hb10-c8",e:5}],"1#-377436619":[{m:"Hh1-g3",e:5}],"-1#-1505924099":[{m:"Ra10-b10",e:5}],"1#-1638972060":[{m:"Hg3-h5",e:5}],"-1#-1345580315":[{m:"Ch8xh3",e:5}],"-1#-856736654":[{m:"Ra10-a8",e:9},{m:"Hb10-c8",e:9}],"1#367553706":[{m:"Hb1-c3",e:5}],"1#-570478898":[{m:"Hb1-c3",e:8.889},{m:"Ra1-a2",e:8.889}],"-1#1408776862":[{m:"Hb10-c8",e:5}],"1#1122510882":[{m:"Hb1-c3",e:5}],"-1#279987055":[{m:"Ra10-b10",e:5}],"1#683830774":[{m:"Ra1-b1",e:5}],"-1#97228648":[{m:"g7-g6",e:5}],"1#1888575509":[{m:"Hg3-f5",e:5}],"-1#644035442":[{m:"g6xg5",e:5}],"1#-1129841851":[{m:"Hf5xe7",e:5}],"1#1992652593":[{m:"Cb3-e3",e:9.855},{m:"g4-g5",e:9.231},{m:"Ch3-e3",e:9.855},{m:"Hb1-c3",e:9.855}],"-1#-595205973":[{m:"Hb10-c8",e:5}],"1#-845811177":[{m:"Ra1-a2",e:5}],"-1#1154775740":[{m:"Ra10-b10",e:5}],"1#2091275301":[{m:"Hb1-c3",e:5}],"-1#788414312":[{m:"Hh10-g8",e:5}],"1#-333003739":[{m:"Ra2-f2",e:5}],"-1#1577340169":[{m:"Rb10-b6",e:6.667},{m:"Ri10-i9",e:6.667}],"-1#964221689":[{m:"c7-c6",e:9.333},{m:"Hb10-c8",e:9.333}],"1#677955653":[{m:"g4-g5",e:8.333},{m:"g4-g5",e:8.75},{m:"Cb3-c3",e:9.286}],"-1#-1701960084":[{m:"Ra10-b10",e:8.333},{m:"Hh10-g8",e:8.333}],"-1#743636693":[{m:"Hb10-c8",e:5}],"1#1027796073":[{m:"Hh1-g3",e:5}],"-1#1929331105":[{m:"c7-c6",e:6.667},{m:"Hh10-g8",e:6.667}],"1#-1315390822":[{m:"Ri1-h1",e:5}],"-1#-1157242454":[{m:"Hh10-g8",e:5}],"1#-1339573524":[{m:"Hb1-a3",e:9.545}],"-1#614276220":[{m:"Hb10-c8",e:9.815}],"1#898436800":[{m:"Ra1-b1",e:9.815},{m:"Cb3-b7",e:9.815},{m:"g4-g5",e:8.75}],"-1#52559420":[{m:"Ch8-g8",e:9.773},{m:"c7-c6",e:9.773}],"-1#687965754":[{m:"Hh10-g8",e:5}],"1#-338068105":[{m:"Ch3-g3",e:5}],"1#1910753129":[{m:"Hh1-g3",e:9.737},{m:"Eg1-e3",e:9.737},{m:"Cb3-e3",e:9.737},{m:"Ra1-a2",e:9.737},{m:"Hb1-c3",e:9.737}],"-1#1046375073":[{m:"Hb10-c8",e:7.5}],"1#793671709":[{m:"Hb1-a3",e:7.5}],"-1#814793797":[{m:"Ra10-b10",e:7.5}],"1#149088988":[{m:"Ra1-b1",e:7.5}],"-1#1045305888":[{m:"Rb10-b6",e:7.5}],"-1#-610053901":[{m:"Hb10-c8",e:6.667}],"1#-894221745":[{m:"Hh1-g3",e:6.667},{m:"Hb1-c3",e:6.667}],"-1#-2062618745":[{m:"Ra10-b10",e:5}],"-1#-1729419006":[{m:"Ra10-b10",e:5}],"-1#-123580478":[{m:"Hb10-c8",e:7.5},{m:"Hh10-i8",e:7.5}],"1#-374186626":[{m:"Ra2-f2",e:6.667}],"1#1893300286":[{m:"Eg1-e3",e:5}],"-1#599501860":[{m:"Hb10-c8",e:9.643},{m:"c7-c6",e:9.643},{m:"Ra10-a9",e:9.643}],"1#1004680549":[{m:"Ec1-e3",e:5}],"1#167379099":[{m:"Ch3-e3",e:5}],"-1#1399687551":[{m:"Ch8-e8",e:5}],"1#805632068":[{m:"Hh1-g3",e:5}],"-1#2142852492":[{m:"Hh10-g8",e:5}],"1#-1117671743":[{m:"Ri1-h1",e:5}],"-1#-1208158735":[{m:"Cb8-c8",e:7.5},{m:"Ra10-a9",e:7.5}],"1#990035859":[{m:"Hb1-a3",e:6.667},{m:"Hb1-c3",e:6.667}],"-1#618398667":[{m:"Ra10-b10",e:5}],"1#481176914":[{m:"Ra1-b1",e:5}],"-1#704830894":[{m:"Rb10-b5",e:5}],"1#77240382":[{m:"Rh1-h5",e:5}],"-1#1767560414":[{m:"Ra10-b10",e:5}],"1#1361640007":[{m:"Ra1-b1",e:5}],"-1#1736706747":[{m:"Rb10-b6",e:5}],"1#345404205":[{m:"Rh1-h7",e:5}],"1#-1348113232":[{m:"Cb3-c3",e:5}],"-1#-1521659991":[{m:"Ra9-f9",e:5}],"1#1650149159":[{m:"Ad1-e2",e:5}],"-1#760370727":[{m:"Rf9-f6",e:5}],"1#-1279543454":[{m:"Rh1-h7",e:5}],"-1#156347679":[{m:"g7-g6",e:5}],"1#2081118818":[{m:"Rh7-g7",e:5}],"-1#1844030346":[{m:"g6xg5",e:5}],"1#-148020291":[{m:"Rg7xg5",e:5}],"-1#-2043032172":[{m:"Ri10-h10",e:5}],"1#899051091":[{m:"Hh1-g3",e:9.986},{m:"Cb3-b5",e:9.986},{m:"Ch3-e3",e:9.986},{m:"Ec1-e3",e:9.986},{m:"Ch3-f3",e:9.986},{m:"Eg1-i3",e:9.986},{m:"g4-g5",e:6.667},{m:"Cb3-e3",e:9.986},{m:"Hb1-c3",e:9.986},{m:"Cb3-b4",e:9.986},{m:"Hh1-i3",e:9.986},{m:"Af1-e2",e:9.986}],"-1#2049688475":[{m:"Hh10-i8",e:9.167}],"-1#48185069":[{m:"g7-g6",e:8.571},{m:"Cb8-e8",e:8.571}],"-1#1862395831":[{m:"Cb8-e8",e:9.892}],"-1#-2022670214":[{m:"Cb8-e8",e:9.8}],"-1#281688298":[{m:"Cb8-e8",e:5}],"1#627183426":[{m:"Hb1-c3",e:5}],"-1#-1007308832":[{m:"Hh10-i8",e:6.667}],"-1#-1613301303":[{m:"Eg10-e8",e:9.977},{m:"Cb8-e8",e:9.977}],"-1#1741554974":[{m:"g7-g6",e:9.722}],"-1#-1914802704":[{m:"Cb8-e8",e:5}],"1#-1200203176":[{m:"Ch3-e3",e:5}],"-1#739798637":[{m:"c7-c6",e:9.375}],"-1#1842316441":[{m:"Hb10-c8",e:8.571}],"1#1338409995":[{m:"Hh1-g3",e:6.667}],"-1#8071619":[{m:"Hh10-g8",e:6.667},{m:"c7-c6",e:6.667}],"1#-1029451122":[{m:"Cb3-e3",e:5}],"-1#1759724820":[{m:"Cb8-d8",e:5}],"1#94818791":[{m:"Hg3-f5",e:5}],"-1#1398047360":[{m:"Hb10-c8",e:5}],"1#1111789628":[{m:"Hb1-c3",e:6.667},{m:"Ch3-i3",e:6.667}],"-1#270334833":[{m:"Ra10-b10",e:5}],"1#678352360":[{m:"Ch3-g3",e:5}],"-1#915458510":[{m:"Rb10-b6",e:5}],"-1#905928483":[{m:"Ra10-b10",e:5}],"1#227373498":[{m:"Ri1-h1",e:5}],"-1#118499978":[{m:"Rb10-b6",e:5}],"1#-1021521160":[{m:"Hb1-c3",e:5}],"-1#-1857766987":[{m:"Hb10-c8",e:5}],"1#-2141934839":[{m:"Ra1-a2",e:5}],"-1#152380322":[{m:"Hh10-g8",e:5}],"1#-875702033":[{m:"Eg1-e3",e:5}],"-1#1297407549":[{m:"Hc8-b6",e:5}],"1#-1828648628":[{m:"Cb3xb8",e:5}],"-1#893139958":[{m:"Ch8xb8",e:5}],"1#-106523780":[{m:"Ri1-h1",e:5}],"-1#-214185908":[{m:"Eg10-e8",e:5}],"1#812053683":[{m:"Hg3-f5",e:5}],"-1#1721018324":[{m:"Hb6xc4",e:5}],"1#-2144306074":[{m:"Hb1-a3",e:9.928},{m:"Hb1-c3",e:9.928},{m:"Ch3-f3",e:9.928},{m:"Ch3-e3",e:9.928},{m:"Hh1-g3",e:9.928},{m:"g4-g5",e:9.888},{m:"Ch3-d3",e:9.928},{m:"Cb3-f3",e:9.928},{m:"Cb3-e3",e:9.928}],"-1#-1611743170":[{m:"Hb10-c8",e:8.75},{m:"c7-c6",e:8.75}],"-1#-764930261":[{m:"c7-c6",e:5}],"1#286256144":[{m:"Hh1-g3",e:6.667}],"-1#1588740568":[{m:"Hb10-c8",e:8}],"-1#-1519637793":[{m:"c7-c6",e:9.677},{m:"Ch8-f8",e:9.677},{m:"Cb8-d8",e:9.677}],"-1#-626526846":[{m:"Hh10-f9",e:9.688},{m:"Eg10-e8",e:9.993}],"-1#-812789330":[{m:"Eg10-e8",e:9.962},{m:"Hh10-f9",e:9.825}],"-1#57829822":[{m:"c7-c6",e:5}],"1#-1072328059":[{m:"Hh1-g3",e:5}],"-1#-446811383":[{m:"Ra10-a9",e:5}],"1#-49829304":[{m:"Hb1-c3",e:5}],"-1#712043516":[{m:"Eg10-e8",e:9.977},{m:"Hh10-f9",e:8.889}],"1#-2118796332":[{m:"c4-c5",e:8.333},{m:"Ch3-e3",e:8.333},{m:"g4-g5",e:9.898},{m:"g4-g5",e:8.333}],"-1#-618515920":[{m:"c7-c6",e:9.993},{m:"Ri10-i9",e:9.993},{m:"Ri10-h10",e:9.993},{m:"Ch8-i8",e:9.993},{m:"Eg10-e8",e:9.993},{m:"Ec10-e8",e:9.993},{m:"Ch8-h2",e:9.993},{m:"Hb10-c8",e:9.993}],"-1#-838330852":[{m:"c7-c6",e:8},{m:"Eg10-e8",e:8},{m:"Ch8-i8",e:8}],"1#225439015":[{m:"Cb3-e3",e:7.5},{m:"Hg3-f5",e:7.5},{m:"Ch3-i3",e:7.5}],"1#223685347":[{m:"Hb1-c3",e:6.667},{m:"Hg3-f5",e:6.667}],"-1#1537702276":[{m:"Af10-e9",e:5}],"1#-202803985":[{m:"Ri1-h1",e:5}],"-1#-109826081":[{m:"Ri10-h10",e:5}],"1#-1556786642":[{m:"Ch3-h7",e:5}],"1#909621220":[{m:"Cb3-e3",e:7.5},{m:"g5xg6",e:7.5}],"-1#-1669914498":[{m:"Eg10-e8",e:5}],"1#1596595329":[{m:"g5xg6",e:5}],"-1#872875159":[{m:"Hh10-f9",e:5}],"1#-1016698476":[{m:"Ch3-g3",e:5}],"-1#-577210958":[{m:"Ee8xg6",e:5}],"1#-1977401619":[{m:"Ra1-a2",e:5}],"-1#56800838":[{m:"Ra10-a9",e:5}],"1#456863495":[{m:"Ra2-f2",e:5}],"-1#-1457936853":[{m:"Eg6-e8",e:5}],"1#-1064153246":[{m:"Cg3-g9",e:5}],"-1#-1524189267":[{m:"Hf9-g7",e:5}],"1#-1399025154":[{m:"Ce3xe7+",e:5}],"-1#187870368":[{m:"Ee8-c6",e:5}],"-1#1562030066":[{m:"Eg10-e8",e:6.667}],"1#-1639476467":[{m:"g6-g7",e:6.667},{m:"Hh1-g3",e:6.667}],"-1#-1036311233":[{m:"Hh10-f9",e:5}],"1#895109180":[{m:"g7-f7",e:5}],"-1#1316532927":[{m:"Ri10-g10",e:5}],"1#-373273866":[{m:"Eg1-e3",e:5}],"-1#1868123172":[{m:"Rg10-g4",e:5}],"-1#-772129083":[{m:"Hh10-f9",e:5}],"1#647713734":[{m:"Ri1-i2",e:5}],"-1#1944002478":[{m:"Ri10-g10",e:5}],"1#-731387929":[{m:"Ri2-f2",e:5}],"1#1878999162":[{m:"Hh1-g3",e:9.444},{m:"Cb3-e3",e:9.444},{m:"Ch3-e3",e:9.444}],"-1#541257138":[{m:"c7-c6",e:9.286},{m:"Hh10-i8",e:9.286},{m:"Hh10-g8",e:9.286},{m:"Ec10-e8",e:9.853},{m:"Hb10-d9",e:9.286}],"1#-1472603570":[{m:"Cb3-e3",e:6.667}],"1#-493218049":[{m:"Hb1-c3",e:5}],"1#710972072":[{m:"Eg1-e3",e:8.571}],"-1#-977283104":[{m:"Hb10-c8",e:6.667}],"1#-726678180":[{m:"Hb1-c3",e:6.667}],"-1#-2030588399":[{m:"Ra10-b10",e:6.667}],"1#-1098547064":[{m:"Ra1-b1",e:6.667}],"-1#-2010550156":[{m:"Ch8-f8",e:6.667},{m:"Hh10-i8",e:6.667}],"1#1261447773":[{m:"Ch3-f3",e:5}],"1#5392264":[{m:"Hh1-g3",e:5}],"-1#896059806":[{m:"Hb10-c8",e:6.667}],"1#611900194":[{m:"Hh1-g3",e:6.667}],"-1#1808103146":[{m:"Ch8-f8",e:6.667},{m:"Hh10-i8",e:6.667}],"1#-1461965629":[{m:"Ri1-h1",e:5}],"-1#-1572767757":[{m:"Ad10-e9",e:7.5}],"1#-474070762":[{m:"Ri1-h1",e:5}],"-1#-383575514":[{m:"Ri10-h10",e:5}],"-1#1075518396":[{m:"Hb10-c8",e:9.985},{m:"Cb8-e8",e:9.985},{m:"g7-g6",e:9.985},{m:"c7-c6",e:9.985},{m:"Hh10-g8",e:9.985},{m:"Ch8-e8",e:9.985},{m:"Hb10-a8",e:9.985},{m:"Cb8-f8",e:9.985},{m:"Ch8-g8",e:9.985},{m:"Ch8-d8",e:9.985},{m:"Ec10-e8",e:9.985},{m:"Cb8-g8",e:9.985},{m:"Eg10-e8",e:9.985}],"1#1359677696":[{m:"g4-g5",e:9.583},{m:"Ch3-i3",e:9.583},{m:"c4-c5",e:9.583},{m:"Hh1-g3",e:9.688},{m:"Hb1-c3",e:9.583}],"-1#649119263":[{m:"Hh10-g8",e:8},{m:"g7-g6",e:8}],"1#-462930606":[{m:"Ri1-h1",e:7.5}],"-1#-285907358":[{m:"Ri10-h10",e:7.5}],"1#-1263264877":[{m:"Rh1-h5",e:7.5}],"1#1407856994":[{m:"Ri1-h1",e:5}],"-1#1500998226":[{m:"Ch8-f8",e:5}],"-1#-1642580600":[{m:"Ra10-a9",e:9.231},{m:"Eg10-e8",e:9.231},{m:"g7-g6",e:9.231},{m:"Cb8-a8",e:9.231}],"1#1564805495":[{m:"Hb1-c3",e:5}],"1#1461323336":[{m:"Hb1-c3",e:5}],"-1#55796301":[{m:"c7-c6",e:7.5},{m:"Hh10-i8",e:7.5}],"1#-1960290895":[{m:"Hh1-g3",e:8}],"1#1974676500":[{m:"Ch3-i3",e:9.231},{m:"g4-g5",e:9.231},{m:"Hb1-c3",e:9.231},{m:"Hh1-g3",e:9.545},{m:"Hh1-g3",e:8.75},{m:"Ra1-a2",e:9.231},{m:"Hh1-g3",e:9.796}],"-1#34136843":[{m:"Hh10-g8",e:5}],"1#-1060104122":[{m:"Ri1-h1",e:5}],"-1#-900906122":[{m:"Hb10-c8",e:5}],"1#-614641206":[{m:"Cb3-d3",e:5}],"-1#-510845391":[{m:"Ad10-e9",e:5}],"1#223094464":[{m:"c4-c5",e:5}],"-1#-1033954744":[{m:"Ri10-h10",e:5}],"1#-1742837831":[{m:"Rh1-h7",e:5}],"-1#586448324":[{m:"e7-e6",e:5}],"-1#1331913711":[{m:"Hb10-c8",e:9},{m:"g7-g6",e:9}],"1#1584623955":[{m:"Hb1-c3",e:8.889}],"-1#204151326":[{m:"Ra10-b10",e:8.889},{m:"Ra10-a9",e:8.889},{m:"Ch8-h6",e:8.889}],"1#878261383":[{m:"c4-c5",e:8.571}],"-1#-79034353":[{m:"Rb10-b6",e:8.75},{m:"g7-g6",e:8.75},{m:"Ch8-f8",e:8.75}],"1#-2007469671":[{m:"Ra1-b1",e:5}],"1#-1911488654":[{m:"Eg1-e3",e:8.333}],"1#343049055":[{m:"Ra1-b1",e:5}],"-1#585003939":[{m:"Ra9-f9",e:5}],"1#-439846099":[{m:"Ad1-e2",e:5}],"-1#-1430164947":[{m:"Hh10-i8",e:5}],"1#582639057":[{m:"c4-c5",e:5}],"-1#-307666599":[{m:"Ri10-i9",e:5}],"1#-1409043139":[{m:"Ch3-i3",e:5}],"1#937582876":[{m:"c4-c5",e:5}],"-1#-118399596":[{m:"Hh10-g8",e:5}],"1#975808217":[{m:"Ec1-e3",e:5}],"-1#-1999681296":[{m:"Ra10-b10",e:5}],"1#-1329764759":[{m:"Ad1-e2",e:5}],"-1#-4950167":[{m:"e7-e6",e:5}],"1#976852114":[{m:"Hb1-c3",e:5}],"-1#1751252959":[{m:"Hb10-c8",e:5}],"1#2037509475":[{m:"Ra1-b1",e:5}],"-1#1339891103":[{m:"Ra10-a9",e:5}],"1#1468302558":[{m:"Rb1-b6",e:5}],"-1#1039022115":[{m:"Ra9-d9",e:5}],"1#1383998848":[{
m:"Rb6xg6",e:5}],"-1#705287029":[{m:"Ch8-g8",e:5}],"1#1559428543":[{m:"Cd3-d6",e:5}],"-1#-811462719":[{m:"Eg10-i8",e:5}],"1#-1852439381":[{m:"Ch3-h7",e:5}],"-1#-442197487":[{m:"c7-c6",e:5}],"1#650338602":[{m:"Cd6-f6",e:5}],"-1#1662973380":[{m:"Rd9-d3",e:5}],"1#-1356337065":[{m:"Eg1-e3",e:5}],"-1#700380805":[{m:"Rd3xc3",e:5}],"1#-1603026608":[{m:"Rg6-g7",e:5}],"-1#-1055593183":[{m:"Rc3xc4",e:5}],"1#-746565630":[{m:"g4-g5",e:5}],"-1#-1622432017":[{m:"Ce8xe4+",e:5}],"1#-584646818":[{m:"Hg3xe4",e:5}],"-1#439891537":[{m:"Rc4xe4",e:5}],"1#1854626647":[{m:"g5-g6",e:5}],"-1#-51206977":[{m:"Hh10-g8",e:5}],"1#1042964466":[{m:"Eg1-e3",e:5}],"-1#-1196205792":[{m:"Hb10-c8",e:5}],"1#-1448916068":[{m:"Cb3-d3",e:5}],"-1#-1821178777":[{m:"Af10-e9",e:5}],"1#-1613184779":[{m:"Ra2-f2",e:5}],"-1#771377625":[{m:"Ch8-h4",e:5}],"1#141783731":[{m:"g4-g5",e:5}],"-1#1152943198":[{m:"c7-c6",e:5}],"1#893512897":[{m:"Cb3-d3",e:9.982},{m:"c4-c5",e:9.982},{m:"Hb1-a3",e:9.982},{m:"Ri1-i2",e:9.982},{m:"Hb1-c3",e:9.982},{m:"Ec1-e3",e:9.982},{m:"Hh1-g3",e:8.333},{m:"Hh1-g3",e:6.667},{m:"Hh1-g3",e:9.985},{m:"Cb3-e3",e:9.982}],"-1#261202746":[{m:"Hb10-c8",e:9.783},{m:"Hh10-g8",e:9.783},{m:"Hb10-a8",e:9.783},{m:"Ch8-e8",e:9.783}],"-1#1610981545":[{m:"Hh10-g8",e:9.091},{m:"Hb10-c8",e:9.091},{m:"Cb8-g8",e:9.091},{m:"Ch8-g8",e:9.091}],"-1#1729726348":[{m:"g7-g6",e:8.75},{m:"Hh10-g8",e:8.571}],"1#-1514046271":[{m:"Cb3-a3",e:8.333}],"-1#-2019097880":[{m:"Hb10-c8",e:6.667},{m:"Hh10-g8",e:6.667}],"1#-1766387628":[{m:"Hb1-d2",e:5}],"1#1166014885":[{m:"c4-c5",e:5}],"-1#456083853":[{m:"Ch8-e8",e:8.571},{m:"Hh10-g8",e:8.571},{m:"Hb10-c8",e:8.571}],"1#2017867958":[{m:"Hb1-a3",e:5}],"-1#1738048750":[{m:"Hh10-g8",e:5}],"1#-1522499677":[{m:"Ha3-b5",e:5}],"-1#-1578875174":[{m:"Cb8xb3",e:5}],"1#-538474291":[{m:"Ch3xb3",e:5}],"-1#-1964239427":[{m:"Hb10-a8",e:5}],"1#-1065658945":[{m:"Ad1-e2",e:5}],"-1#-1888336705":[{m:"Ri10-h10",e:5}],"1#-718063282":[{m:"Ec1-e3",e:5}],"-1#1742067559":[{m:"Ra10-a9",e:5}],"1#2139901478":[{m:"Ra1-d1",e:5}],"-1#361569175":[{m:"Ra9-f9",e:5}],"1#-761588967":[{m:"Hb5-d6",e:5}],"-1#1593346560":[{m:"Rf9-f4",e:5}],"1#-638078272":[{m:"Hb1-a3",e:7.5}],"1#171924273":[{m:"Ri1-i2",e:6.667},{m:"Hh1-g3",e:5}],"-1#1601902425":[{m:"Hh10-g8",e:5}],"1#-1650201580":[{m:"Hb1-a3",e:5}],"-1#-2105716660":[{m:"c7-c6",e:5}],"1#1092266871":[{m:"Ha3-b5",e:5}],"-1#1170117134":[{m:"Cb8xb3",e:5}],"1#1002265625":[{m:"Ch3xb3",e:5}],"-1#1857470825":[{m:"Ch8-h5",e:5}],"1#-1239409754":[{m:"Hb5-a3",e:5}],"-1#-1299963169":[{m:"Ra10-b10",e:5}],"1#-1963586490":[{m:"Ra1-b1",e:5}],"-1#-1134887750":[{m:"Eg10-e8",e:5}],"-1#1123689438":[{m:"Ch8-e8",e:9.907},{m:"Ch8-d8",e:9.907},{m:"Hh10-g8",e:9.907},{m:"Ch8-f8",e:9.907}],"1#563303141":[{m:"Ri1-h1",e:6.667}],"-1#722340309":[{m:"Hh10-g8",e:6.667}],"1#-371789160":[{m:"c4-c5",e:6.667}],"1#1426688531":[{m:"Ri1-h1",e:8.889}],"-1#1603588387":[{m:"Hh10-g8",e:8.889}],"1#-1655952786":[{m:"Rh1-h5",e:8.889},{m:"c4-c5",e:8.889},{m:"Hb1-a3",e:8.889},{m:"Hb1-c3",e:8.889},{m:"a4-a5",e:8.889}],"-1#226993350":[{m:"Ri10-h10",e:5}],"1#1472649527":[{m:"Rh5xh10",e:5}],"-1#1067611239":[{m:"Hg8xh10",e:5}],"1#1674006414":[{m:"Cb3-e3",e:5}],"-1#-913844204":[{m:"Hh10-g8",e:5}],"1#190784345":[{m:"Hb1-c3",e:5}],"-1#1493649428":[{m:"Hb10-a8",e:5}],"1#328206358":[{m:"Ra1-b1",e:5}],"-1#624752874":[{m:"Ra10-b10",e:5}],"1#491705971":[{m:"Rb1-b5",e:5}],"-1#1381963494":[{m:"Ec10-e8",e:9.667},{m:"Ri10-i9",e:9.667},{m:"Cb8-b4",e:9.667},{m:"Hb10-a8",e:9.667}],"1#2127369733":[{m:"Hb1-c3",e:8.571},{m:"Ec1-e3",e:8.571}],"1#334873218":[{m:"Rh1-h5",e:8.571},{m:"Hb1-c3",e:8.571}],"1#-275619870":[{m:"Hb1-c3",e:5}],"1#415782628":[{m:"Cb3-d3",e:9.474},{m:"Cb3-e3",e:9.474}],"-1#-2104322506":[{m:"a7-a6",e:5}],"1#-2035250380":[{m:"Ad1-e2",e:5}],"-1#-910583244":[{m:"Cd8-d4",e:5}],"1#1218975007":[{m:"Eg1-e3",e:5}],"-1#-835644467":[{m:"Cd4xa4",e:5}],"1#-547024452":[{m:"Ha3-b1",e:5}],"-1#-1061442076":[{m:"Cb8-a8",e:5}],"1#163159588":[{m:"Hb1-c3",e:5}],"-1#1541535081":[{m:"Ri10-i9",e:5}],"1#441131277":[{m:"Ra1-b1",e:5}],"-1#-820756189":[{m:"Hb10-a8",e:6.667}],"1#-2055012063":[{m:"c4-c5",e:6.667}],"-1#1250966953":[{m:"Ri10-i9",e:9.6},{m:"Eg10-e8",e:9.6},{m:"Ec10-e8",e:9.6},{m:"Cb8-b4",e:9.6},{m:"Ra10-a9",e:9.6},{m:"Af10-e9",e:9.6}],"1#188410317":[{m:"Rh1-h5",e:5}],"1#1711422794":[{m:"a4-a5",e:5}],"-1#-1289580766":[{m:"Hb10-a8",e:5}],"1#-105525472":[{m:"Hb1-a3",e:5}],"-1#-429165704":[{m:"Ra10-a9",e:5}],"1#-30217671":[{m:"Cb3-b5",e:5}],"-1#-914638201":[{m:"Eg10-e8",e:5}],"1#170296952":[{m:"Cb5-c5",e:5}],"-1#-1640787018":[{m:"Cb8-b9",e:5}],"1#1665683773":[{m:"Ra1-b1",e:5}],"-1#1441046977":[{m:"Cb9-g9",e:5}],"1#-903765064":[{m:"Rb1-b8",e:5}],"-1#-477264638":[{m:"Af10-e9",e:5}],"1#-2145199981":[{m:"Ri1-h1",e:9.894},{m:"c4-c5",e:9.894}],"-1#-1967160413":[{m:"Ri10-h10",e:9.891}],"1#-788595118":[{m:"Rh1-h5",e:9.891},{m:"c4-c5",e:9.891},{m:"Rh1-h7",e:9.891},{m:"Hb1-c3",e:9.891},{m:"Hb1-a3",e:9.891}],"-1#1077244154":[{m:"Ch8-i8",e:9.643},{m:"Hb10-c8",e:9.643},{m:"Cb8-b6",e:9.643}],"1#1361404486":[{m:"g4-g5",e:8.75}],"-1#535675610":[{m:"Cb8-b4",e:9.444},{m:"Ch8-h4",e:9.444},{m:"Hb10-c8",e:9.444}],"1#-1574925346":[{m:"e4-e5",e:8}],"1#979696048":[{m:"Hb1-c3",e:8.333}],"-1#1779754031":[{m:"Ch8-h9",e:9.773},{m:"Ec10-e8",e:9.773},{m:"Cb8-d8",e:9.773},{m:"Hb10-c8",e:9.773}],"-1#-2103012065":[{m:"Ch8-h4",e:7.5},{m:"Hb10-c8",e:7.5}],"1#-1490047371":[{m:"Hb1-c3",e:8.333}],"1#-1816754269":[{m:"Ra1-a2",e:6.667}],"-1#-819969526":[{m:"Hb10-c8",e:5}],"1#-567258954":[{m:"a4-a5",e:5}],"-1#-262212102":[{m:"Ra10-b10",e:5}],"1#-936584349":[{m:"Cb3-d3",e:5}],"-1#1328669723":[{m:"Ec10-e8",e:6.667},{m:"Ri10-h10",e:6.667}],"1#1671685368":[{m:"Ri1-h1",e:7.5},{m:"Hb1-c3",e:7.5}],"-1#1765720008":[{m:"Ri10-h10",e:5}],"1#864010809":[{m:"Rh1-h5",e:5}],"-1#-1548465007":[{m:"Hb10-c8",e:5}],"1#-1297850835":[{m:"Hb1-c3",e:5}],"-1#-520342176":[{m:"Cb8-b6",e:5}],"-1#838569909":[{m:"Hb10-d9",e:6.667},{m:"Hg8-h6",e:6.667}],"1#1004138671":[{m:"Ri1-h1",e:5}],"-1#826583967":[{m:"Hg8-f6",e:5}],"1#-1405982918":[{m:"Hc3-d5",e:5}],"-1#-2039375609":[{m:"Hb10-d9",e:5}],"1#359700970":[{m:"Hb1-c3",e:5}],"-1#1193865895":[{m:"Ec10-e8",e:5}],"1#1807413828":[{m:"Ri1-i2",e:5}],"-1#1056882220":[{m:"Hb10-c8",e:5}],"1#804170896":[{m:"Ec1-e3",e:5}],"-1#-1660403015":[{m:"Ad10-e9",e:5}],"1#1909029448":[{m:"Ri2-f2",e:5}],"-1#2099032114":[{m:"Ch8-i8",e:5}],"1#1090376385":[{m:"Ad1-e2",e:5}],"-1#267699137":[{m:"Cb8-b4",e:5}],"1#-1304851771":[{m:"g4-g5",e:5}],"-1#-17662936":[{m:"g6xg5",e:5}],"1#1681306655":[{m:"Ee3xg5",e:5}],"1#-2115798537":[{m:"Ri1-h1",e:8}],"-1#-1954667833":[{m:"Hh10-g8",e:8}],"1#1235671434":[{m:"c4-c5",e:8},{m:"Rh1-h7",e:8},{m:"Cb3-e3",e:8}],"-1#-2034899710":[{m:"Hb10-c8",e:7.5}],"1#-1750730818":[{m:"Hb1-c3",e:7.5}],"-1#-973234957":[{m:"Ad10-e9",e:7.5},{m:"Ec10-e8",e:7.5},{m:"Cb8-b4",e:7.5}],"1#691840002":[{m:"Cb3-b5",e:5}],"-1#511046844":[{m:"Ec10-e8",e:5}],"1#854062175":[{m:"g4-g5",e:5}],"-1#2116813490":[{m:"Ra10-d10",e:5}],"1#-378561520":[{m:"Rh1-h7",e:5}],"-1#1401259629":[{m:"Ri10-i8",e:5}],"1#146839806":[{m:"g4-g5",e:5}],"-1#1141599763":[{m:"g6xg5",e:5}],"1#2016466423":[{m:"Hc3-d5",e:5}],"-1#1383279562":[{m:"Cb4xg4",e:5}],"1#-1407343013":[{m:"Eg1-e3",e:5}],"-1#713334921":[{m:"Ri10-h10",e:5}],"-1#-213072905":[{m:"Hb10-c8",e:5}],"1#-497233589":[{m:"Rh7-g7",e:5}],"-1#-205643613":[{m:"Cf8-f9",e:5}],"1#-1123504256":[{m:"Rg7xg6",e:5}],"-1#-50782768":[{m:"Cf9-g9",e:5}],"1#1412819047":[{m:"Rg6-d6",e:5}],"-1#750724142":[{m:"Ec10-e8",e:5}],"1#2958541":[{m:"Ec1-e3",e:5}],"-1#-1295267100":[{m:"c7-c6",e:5}],"1#1907110367":[{m:"Rd6-d7",e:5}],"-1#-2073441007":[{m:"Hg8-f6",e:5}],"1#639113634":[{m:"Rd7-d2",e:5}],"-1#-1532597457":[{m:"Ad10-e9",e:5}],"1#1214731230":[{m:"Rd2-h2",e:5}],"-1#-1519687658":[{m:"Ra10-d10",e:5}],"1#1665493372":[{m:"g4-g5",e:5}],"-1#797876113":[{m:"Cb8-b4",e:5}],"1#-1841047915":[{m:"Hb1-d2",e:5}],"-1#-471446000":[{m:"Hb10-c8",e:5}],"1#-218735444":[{m:"Hb1-c3",e:5}],"-1#-1599195167":[{m:"Ra10-b10",e:5}],"1#-1730406024":[{m:"Ra1-b1",e:5}],"-1#-1368331900":[{m:"Af10-e9",e:5}],"1#-1562694378":[{m:"Rb1-b5",e:5}],"-1#-92987603":[{m:"Cb8-a8",e:5}],"1#863448301":[{m:"Rb5xb10",e:5}],"-1#-421645148":[{m:"Hc8xb10",e:5}],"1#1622896680":[{m:"Ce3xe7+",e:5}],"-1#-954905226":[{m:"Cf8-e8",e:5}],"1#2058899733":[{m:"Ce7-e6",e:5}],"-1#-2124633040":[{m:"Hg8-e7",e:5}],"1#2030056465":[{m:"Ce6xe8+",e:5}],"-1#-1937975666":[{m:"Eg10xe8",e:5}],"1#-1607134833":[{m:"e4-e5",e:5}],"-1#666563779":[{m:"He7-c6",e:5}],"1#209428286":[{m:"Rh1-h5",e:5}],"-1#-1627292837":[{m:"Hh10-g8",e:9.773},{m:"Hb10-c8",e:9.773}],"1#1574535190":[{m:"Hb1-c3",e:9.333}],"1#-1911461401":[{m:"Hb1-c3",e:9.667}],"1#-2088968057":[{m:"Ec1-e3",e:9.722},{m:"Ri1-i2",e:9.722},{m:"Cb3-c3",e:9.722},{m:"Ch3-i3",e:9.722},{m:"g4-g5",e:9.722}],"-1#832179886":[{m:"Hh10-i8",e:9.375},{m:"Ec10-e8",e:9.375},{m:"Hb10-c8",e:9.375}],"1#-1176422062":[{m:"Hb1-d2",e:6.667}],"1#545922066":[{m:"g4-g5",e:8.571}],"-1#-700928785":[{m:"Eg10-e8",e:6.667}],"1#358977552":[{m:"Cb3-e3",e:6.667}],"-1#-1088092278":[{m:"Hb10-c8",e:6.667}],"1#-1372252874":[{m:"Hb1-c3",e:6.667}],"-1#-59933061":[{m:"Ra10-b10",e:6.667}],"1#-1004580638":[{m:"e4-e5",e:6.667}],"-1#-1986739298":[{m:"Ec10-e8",e:8},{m:"Eg10-e8",e:8}],"1#-1526283395":[{m:"Hb1-a3",e:7.5}],"-1#-1160216795":[{m:"g7-g6",e:7.5}],"1#1254752097":[{m:"Hb1-a3",e:5}],"-1#1427587897":[{m:"Hb10-c8",e:5}],"-1#-188272744":[{m:"Hh10-g8",e:8},{m:"Ch8-d8",e:8}],"1#908055765":[{m:"Ri1-h1",e:7.5}],"-1#1015189477":[{m:"Ri10-h10",e:7.5}],"1#-483097003":[{m:"Ri1-h1",e:5}],"-1#-374743707":[{m:"Hh10-g8",e:5}],"1#-2101092111":[{m:"Ch3-i3",e:8.333},{m:"g4-g5",e:8.333},{m:"Hh1-g3",e:9.333}],"-1#-176672786":[{m:"Hh10-g8",e:9.907}],"1#594700935":[{m:"g4-g5",e:8.333},{m:"Ri1-h1",e:8.333},{m:"Hh1-g3",e:9.091}],"-1#703541687":[{m:"Hh10-g8",e:6.667}],"1#-348665094":[{m:"c4-c5",e:6.667},{m:"Ri1-h1",e:5}],"-1#-1668545051":[{m:"Ri10-i9",e:6.667},{m:"Hb10-c8",e:6.667}],"1#-584658559":[{m:"Hb1-c3",e:5}],"1#-1919150247":[{m:"c4-c5",e:5}],"-1#1116679121":[{m:"Ra10-a9",e:5}],"1#1524019856":[{m:"Ad1-e2",e:5}],"-1#366977936":[{m:"Ra9-d9",e:5}],"1#2052046387":[{m:"Cb3-e3",e:5}],"-1#-804312663":[{m:"Rd9-d4",e:5}],"1#2042102514":[{m:"g4-g5",e:5}],"-1#896791583":[{m:"Rd4-d5",e:5}],"1#1867294864":[{m:"Ce3-c3",e:5}],"-1#-768005278":[{m:"Rd5xg5",e:5}],"1#-2094929609":[{m:"Ec1-e3",e:5}],"-1#835127070":[{m:"Rg5-g6",e:5}],"1#-693441371":[{m:"Ci3-i2",e:5}],"-1#-879440583":[{m:"Rg6-b6",e:5}],"1#1279809823":[{m:"Hb1-d2",e:5}],"-1#-1643165670":[{m:"e7-e6",e:5}],"1#1021132141":[{m:"Hg3-f5",e:5}],"-1#1781493258":[{m:"e6-e5",e:5}],"1#-2031129922":[{m:"e4xe5",e:5}],"-1#-388574443":[{m:"Hc8-e7",e:5}],"1#-420350207":[{m:"Hf5-h6",e:5}],"-1#-2124334499":[{m:"Ri10-h10",e:5}],"1#-618641492":[{m:"Hh6xg8",e:5}],"-1#-40766102":[{m:"Rh10xh1",e:5}],"1#-974358572":[{m:"Hg8xe7",e:5}],"-1#35438633":[{m:"Ce8xe5",e:5}],"1#444069373":[{m:"c5-c6",e:5}],"-1#1974215489":[{m:"Rb6-b4",e:5}],"1#-431713209":[{m:"He7-d9",e:5}],"-1#-212831564":[{m:"Ad10-e9",e:5}],"1#529615429":[{m:"Hd9xb8",e:5}],"-1#-1379372628":[{m:"Rb4xb8",e:5}],"1#619058721":[{m:"Hd2-c4",e:5}],"-1#-867740994":[{m:"Ce5-e6",e:5}],"1#1548523369":[{m:"c6-d6",e:5}],"-1#526992385":[{m:"Ce6-e4",e:5}],"1#-845598506":[{m:"Cc3xc7",e:5}],"-1#889087508":[{m:"Rh1xg1",e:5}],"1#403766589":[{m:"Cc7-e7+",e:5}],"-1#-1903179526":[{m:"Ec10-e8",e:5}],"1#-1575106535":[{m:"Hc4-e5",e:5}],"-1#-787452903":[{m:"Rg1-g5",e:5}],"1#-1429962261":[{m:"Ra1-c1",e:5}],"-1#243791783":[{m:"Ke10-d10",e:5}],"1#2003915486":[{m:"Rc1-d1",e:5}],"-1#-1527888302":[{m:"Rg5xe5",e:5}],"1#872284266":[{m:"d6-e6+",e:5}],"-1#1094878828":[{m:"Kd10-e10",e:5}],"1#951329557":[{m:"Ce7xe5",e:5}],"-1#-1128954896":[{m:"Ce4xe6",e:5}],"1#248874462":[{m:"Rd1-d6",e:5}],"-1#-1534185918":[{m:"Rb8-b1+",e:5}],"1#556866575":[{m:"Ae2-d1",e:5}],"-1#1849167119":[{m:"Ce6-i6",e:5}],"1#469641362":[{m:"Ci2-g2",e:5}],"-1#1838283710":[{m:"Eg10-i8",e:5}],"1#866513108":[{m:"Rd6-h6",e:5}],"-1#-374057758":[{m:"Rb1-b4",e:5}],"1#-1739330721":[{m:"i4-i5",e:5}],"-1#642577215":[{m:"Rb4-e4",e:5}],"1#1661195630":[{m:"Ce5-c5",e:5}],"-1#-2073540716":[{m:"Re4xe3+",e:5}],"1#-1591883590":[{m:"Cg2-e2",e:5}],"-1#1163413720":[{m:"Re3-e5",e:5}],"1#1884434573":[{m:"Cc5-c7",e:5}],"-1#-1280420235":[{m:"Re5xi5",e:5}],"1#-1195016417":[{m:"Cc7xi7",e:5}],"-1#270991473":[{m:"Ri5-d5",e:5}],"1#-1919511600":[{m:"Rh6xi6",e:5}],"-1#-809243937":[{m:"Ke10-d10",e:5}],"1#-1238020186":[{m:"Ce2-i2",e:5}],"-1#969026457":[{m:"Rd5xd1+",e:5}],"1#598740847":[{m:"Ke1-e2",e:5}],"-1#-2089011872":[{m:"g7-g6",e:5}],"1#-165232099":[{m:"Ri6-i5",e:5}],"-1#1413245062":[{m:"Rd1-d7",e:5}],"1#46640783":[{m:"Ci7-i6",e:5}],"-1#-507625189":[{m:"Rd7-e7+",e:5}],"1#-80970635":[{m:"Ke2-f2",e:5}],"-1#2120299844":[],"1#176970686":[{m:"g4-g5",e:5}],"-1#1179102547":[{m:"Ra10-a9",e:5}],"1#1579037714":[{m:"Cb3-e3",e:5}],"-1#-195124344":[{m:"Hh10-g8",e:5}],"1#914774213":[{m:"Hg3-f5",e:5}],"-1#1618217890":[{m:"Eg10-e8",e:5}],"1#-1557579939":[{m:"Hb1-c3",e:5}],"-1#-244229104":[{m:"Ra9-f9",e:5}],"1#912741534":[{m:"Ch3-h5",e:5}],"-1#1178081949":[{m:"Cb8-b6",e:5}],"1#-1949062238":[{m:"Ra1-b1",e:5}],"-1#-1115727010":[{m:"Cb6-i6",e:5}],"1#-315054933":[{m:"Eg1-i3",e:5}],"-1#458974488":[{m:"Af10-e9",e:5}],"1#401645962":[{m:"c4-c5",e:5}],"-1#-656171774":[{m:"Ci6-e6",e:5}],"1#-2009415640":[{m:"Hf5xg7",e:5}],"-1#-891789597":[{m:"Ce6xe3",e:5}],"1#1328971830":[{m:"Ec1xe3",e:5}],"-1#-52554923":[{m:"i7-i6",e:5}],"1#-214704758":[{m:"Rb1-b6",e:5}],"-1#-1722195593":[{m:"Ri10-i7",e:5}],"1#1553341353":[{m:"g5-g6",e:5}],"-1#1050318010":[{m:"c7-c6",e:5}],"1#-33722495":[{m:"c5xc6",e:5}],"-1#-1032973227":[{m:"Ee8xg6",e:5}],"1#-1781178614":[{m:"Ch5-c5",e:5}],"-1#-147308503":[{m:"Eg6-e8",e:5}],"1#-1632392864":[{m:"Ri1-h1",e:5}],"-1#-1808862640":[{m:"Rf9-h9",e:5}],"1#980122216":[{m:"Hg7-f5",e:5}],"-1#422556586":[{m:"Ae9-f10",e:5}],"1#361002808":[{m:"Rb6-b8",e:5}],"-1#1268767246":[{m:"i6-i5",e:5}],"1#1922407500":[{m:"Cb3-e3",e:6.667},{m:"Ch3-i3",e:6.667}],"-1#-657126442":[{m:"Hb10-c8",e:5}],"1#-909829782":[{m:"Hb1-c3",e:5}],"-1#-1684180441":[{m:"Ra10-b10",e:5}],"1#-1544594242":[{m:"Ra1-a2",e:5}],"-1#716100629":[{m:"Rb10-b6",e:5}],"1#1505537411":[{m:"Ra2-f2",e:5}],"-1#-341957457":[{m:"Ad10-e9",e:5}],"1#123673694":[{m:"e4-e5",e:5}],"-1#-2133788398":[{m:"Ec10-e8",e:5}],"1#-1404896783":[{m:"Hg3-e4",e:5}],"-1#1329548526":[{m:"Hh10-i8",e:5}],"1#-951813358":[{m:"Ri1-i2",e:5}],"-1#-1845479558":[{m:"Ch8-h4",e:5}],"1#-1215755248":[{m:"e5-e6",e:5}],"-1#1030028221":[{m:"Ch4xe4+",e:5}],"1#1771073418":[{m:"Hc3xe4",e:5}],"-1#86922067":[{m:"Hb10-c8",e:5}],"1#339624431":[{m:"Ri1-h1",e:5}],"-1#514005727":[{m:"Hh10-g8",e:5}],"1#-595861102":[{m:"Rh1-h7",e:5}],"-1#1720843247":[{m:"Af10-e9",e:5}],"1#1782202237":[{m:"Hb1-a3",e:5}],"-1#1977910053":[{m:"a7-a6",e:5}],"1#1908842023":[{m:"Ra1-b1",e:5}],"-1#1198157531":[{m:"Ra10-b10",e:5}],"1#2132295746":[{m:"Cb3-b5",e:5}],"-1#1213272316":[{m:"Rb10-b6",e:5}],"1#994273642":[{m:"Cb5-i5",e:5}],"-1#-1128534976":[{m:"Rb6-i6",e:5}],"1#-1035903907":[{m:"Ci5-h5",e:5}],"-1#1323665244":[{m:"Ri6-g6",e:5}],"1#-1440836586":[{m:"Ch5xh8",e:5}],"1#920663414":[{m:"Eg1-e3",e:7.5},{m:"Ri1-h1",e:7.5},{m:"c4-c5",e:7.5}],"-1#-1334234204":[{m:"Hh10-i8",e:5}],"1#939656280":[{m:"Cb3-d3",e:8.571},{m:"Ri1-h1",e:8.571}],"-1#47336355":[{m:"Cb8-e8",e:5}],"1#930774027":[{m:"Hb1-c3",e:5}],"-1#1696732998":[{m:"Hb10-c8",e:5}],"1#1949435386":[{m:"Ra1-b1",e:5}],"-1#849305448":[{m:"Ri10-h10",e:8.333}],"1#1759388313":[{m:"Ch3-h7",e:8.333},{m:"Hb1-a3",e:8.333}],"-1#485276707":[{m:"g7-g6",e:8}],"-1#1014853190":[{m:"g7-g6",e:5}],"1#1227331899":[{m:"Eg1-e3",e:5}],"-1#-809590807":[{m:"Hh10-i8",e:5}],"1#1204135957":[{m:"c4-c5",e:5}],"-1#-1999203171":[{m:"Ri10-i9",e:5}],"1#-914603783":[{m:"Ch3-h8",e:5}],"-1#-1062692572":[{m:"Ec10-e8",e:5}],"1#-331703865":[{m:"Hb1-c3",e:5}],"-1#-1100811638":[{m:"g6-g5",e:5}],"1#-940370883":[{m:"Ee3xg5",e:5}],"-1#-101512706":[{m:"g7-g6",e:5}],"1#-1935016317":[{m:"Hb1-c3",e:5}],"-1#-554592818":[{m:"Hb10-a8",e:5}],"1#-1805199924":[{m:"Eg1-e3",e:5}],"-1#318755614":[{m:"Hh10-i8",e:5}],"1#-1702566686":[{m:"Cb3-b7",e:5}],"-1#-2046268392":[{m:"Ad10-e9",e:5}],"1#1791579369":[{m:"Cb7xe7+",e:5}],"-1#2074834647":[{m:"Ec10-e8",e:5}],"1#1463383604":[{m:"Ra1-b1",e:5}],"1#1474867825":[{m:"Ri1-h1",e:6.667}],"-1#1568008513":[{m:"Hh10-g8",e:6.667}],"1#-1616047604":[{m:"g4-g5",e:6.667}],"1#1820924767":[{m:"Ch3-i3",e:5}],"-1#456315968":[{m:"Hh10-i8",e:5}],"1#-1823874116":[{m:"Ri1-h1",e:5}],"-1#-1714112372":[{m:"Ri10-h10",e:5}],"1#-1013594755":[{m:"Hb1-a3",e:5}],"-1#-599033563":[{m:"a7-a6",e:5}],"1#-664181721":[{m:"g4-g5",e:5}],"-1#-1801284918":[{m:"Hb10-c8",e:5}],"1#-2051899274":[{m:"Eg1-e3",e:5}],"-1#53184164":[{m:"a6-a5",e:5}],"1#-1286532776":[{m:"a4xa5",e:5}],"-1#185971113":[{m:"Ra10xa5",e:5}],"1#175334170":[{m:"Ci3-i2",e:5}],"-1#390939270":[{m:"i7-i6",e:5}],"1#413174873":[{m:"Cb3-c3",e:5}],"-1#306753344":[{m:"Ra5-a6",e:5}],"1#-399024102":[{m:"Ra1-b1",e:5}],"-1#-560230170":[{m:"Cb8-b2",e:5}],"1#1881914337":[{m:"Ha3-b5",e:5}],"-1#1955562136":[{m:"Cb2-f2",e:5}],"1#-580245361":[{m:"Hb5xc7",e:5}],"-1#784099738":[{m:"Ra6-a9",e:5}],"1#1463111249":[{m:"Hg3-f5",e:5}],"-1#29826358":[{m:"Ch8-f8",e:5}],"1#-1025620193":[{m:"Rh1xh10",e:5}],"-1#665605014":[{m:"Hi8xh10",e:5}],"1#829072590":[{m:"Rb1-b6",e:5}],"-1#1526732851":[{m:"Hh10-i8",e:5}],"1#-746901553":[{m:"i4-i5",e:5}],"-1#1835284399":[{m:"Cf2-h2",e:5}],"1#1951474444":[{m:"i5xi6",e:5}],"-1#-1518387679":[{m:"Ch2-h1+",e:5}],"1#1721263771":[{m:"Af1-e2",e:5}],"-1#1052871761":[{m:"Ch1-i1",e:5}],"1#1224761733":[{m:"Eg1-e3",e:5}],"-1#-812030121":[{m:"Cg8xg4",e:5}],"1#-2061379077":[{m:"c4-c5",e:5}],"-1#1244849523":[{m:"Ra10-a8",e:5}],"1#-1825196629":[{m:"Hb1-c3",e:5}],"-1#-1049764122":[{m:"Ra8-d8",e:5}],"1#1750113946":[{m:"Af1-e2",e:5}],"-1#805925968":[{m:"Hh10-g8",e:5}],"1#-221147363":[{m:"Ri1-f1",e:5}],"-1#-543352873":[{m:"Ch8-i8",e:5}],"1#-495160028":[{m:"Rf1-f4",e:5}],"-1#535960521":[{m:"Ri10-h10",e:5}],"1#1169385016":[{m:"Ch3-h1",e:5}],"-1#2017099595":[{m:"Cg4-g6",e:5}],"1#-2143287992":[{m:"Hc3-b5",e:5}],"-1#-916264156":[{m:"Hb10-a8",e:5}],"1#-2081051866":[{m:"Ch1-f1",e:5}],"-1#176596654":[{m:"Af10-e9",e:5}],"1#103637564":[{m:"Cb3-d3",e:5}],"-1#1023225287":[{m:"Rh10-h2",e:5}],"1#182763730":[{m:"a4-a5",e:5}],"-1#613049758":[{m:"Cg6-h6",e:5}],"1#-1398303299":[{m:"Ee3-g1",e:5}],"-1#708744047":[{m:"g7-g6",e:5}],"1#1600414738":[{m:"Rf4-f5",e:5}],"-1#707172481":[{m:"Ci8-i9",e:5}],"1#-1948222688":[{m:"Ec1-e3",e:5}],"-1#956732681":[{m:"Rh2-g2",e:5}],"1#1427221424":[{m:"Hg3-h5",e:5}],"-1#1687354417":[{m:"Ci9xi4",e:5}],"1#-1661840258":[{m:"Hh5-i3",e:5}],"-1#-79516151":[{m:"Rg2-h2",e:5}],"1#-1756000080":[{m:"Ra1-c1",e:5}],"1#-2092554429":[{m:"c4-c5",e:6.667},{m:"a4-a5",e:6.667}],"-1#1280646091":[{m:"Hb10-a8",e:5}],"1#113400777":[{m:"Hb1-c3",e:5}],"-1#1419391108":[{m:"Ra10-a9",e:8},{m:"Hh10-f9",e:8}],"1#1287891397":[{m:"Ch3-i3",e:7.5}],"-1#997746394":[{m:"Hh10-g8",e:7.5},{m:"Ra9-c9",e:7.5},{m:"Ra9-d9",e:7.5}],"1#-106914409":[{m:"Ri1-h1",e:5}],"1#1424522105":[{m:"Ri1-h1",e:5}],"1#-1543807609":[{m:"Ri1-i2",e:5}],"-1#-155250193":[{m:"Hf9-d8",e:5}],"1#928982621":[{m:"Hc3-d5",e:5}],"-1#488429664":[{m:"c7-c6",e:5}],"1#-562355365":[{m:"Ec1-e3",e:5}],"-1#-1389854193":[{m:"Hb10-c8",e:5}],"1#-1137143629":[{m:"Hb1-a3",e:5}],"-1#-1545196309":[{m:"c7-c6",e:5}],"1#1619122128":[{m:"Ha3-b5",e:5}],"-1#1680207529":[{m:"Ra10-b10",e:5}],"1#1549254704":[{m:"Hb5xa7",e:5}],"-1#1254939609":[{m:"Cb8-a8",e:5}],"1#-2083592167":[{m:"Ha7xc8",e:5}],"-1#323639228":[{m:"Ch8xc8",e:5}],"1#-1993499574":[{m:"Cb3-a3",e:5}],"-1#-1162635994":[{m:"g7-g6",e:5}],"1#-806788517":[{m:"a5-a6",e:5}],"-1#1854321479":[{m:"Hh10-g8",e:5}],"1#-1403107318":[{m:"a6-a7",e:5}],"-1#2078496628":[{m:"Ca8xa3",e:5}],"1#1731948625":[{m:"Ch3xa3",e:5}],"-1#371766858":[{m:"Cb8-e8",e:9.756},{m:"c7-c6",e:9.756},{m:"Hh10-g8",e:9.756},{m:"Hb10-c8",e:9.756},{m:"Ec10-e8",e:9.756},{m:"Ch8-e8",e:9.756},{m:"i7-i6",e:9.756}],"1#595624418":[{m:"Cb3-e3",e:9},{m:"Hb1-c3",e:9}],"-1#-1983900040":[{m:"Hb10-c8",e:5}],"1#-1731197756":[{m:"Hb1-c3",e:5}],"-1#-897028215":[{m:"Ra10-b10",e:5}],"1#-218480368":[{m:"Ra1-a2",e:5}],"-1#2075904443":[{m:"Rb10-b4",e:5}],"1#-2036584358":[{m:"Ra2-f2",e:5}],"-1#884914550":[{m:"Hh10-i8",e:5}],"1#-1127903606":[{m:"Ri1-i2",e:5}],"-1#-377371934":[{m:"Rb4xc4",e:5}],"1#-1919079931":[{m:"i4-i5",e:5}],"-1#864170597":[{m:"Ad10-e9",e:5}],"1#-549254508":[{m:"Rf2-f9",e:5}],"-1#-1044775058":[{m:"Ch8-h6",e:5}],"1#-93289364":[{m:"Rf9-f6",e:5}],"-1#-1130106163":[{m:"Ch6-h4",e:5}],"1#-1086421548":[{m:"Ri2-d2",e:5}],"-1#286468407":[{m:"Ch4xe4+",e:5}],"1#-1758382705":[{m:"Hc3xe4",e:5}],"-1#-843811060":[{m:"Ce8xe4+",e:5}],"1#-753659365":[{m:"Af1-e2",e:5}],"-1#-1957824303":[{m:"Ri10-h10",e:5}],"1#-787708640":[{m:"Ch3-h5",e:5}],"-1#-1588344029":[{m:"Rh10-h8",e:5}],"1#1748944577":[{m:"Rd2-d9",e:5}],"-1#2124158090":[{m:"Ce4-e6",e:5}],"1#962299185":[{m:"Ec1-a3",e:5}],"-1#-1770892850":[{m:"Rc4-e4",e:5}],"1#-849324027":[{m:"Ce3xe6",e:5}],"-1#157272414":[{m:"Re4xe6",e:5}],"1#-1482639716":[{m:"Rf6-f9",e:5}],"-1#-512507843":[{m:"g7-g6",e:5}],"-1#1910041263":[{m:"Hb10-c8",e:9},{m:"Hh10-g8",e:9}],"1#1623783443":[{m:"Ra1-b1",e:8.889},{m:"c4-c5",e:8.889},{m:"Hh1-i3",e:8.333},{m:"Ri1-i2",e:8.889}],"-1#1449396463":[{m:"Hc8-b10",e:8.333},{m:"Hb10-c8",e:5},{m:"Ra10-b10",e:8.333}],"1#-1799556190":[{m:"Cb3-a3",e:6.667},{m:"c4-c5",e:6.667}],"-1#-1490879794":[{m:"Ra10-a9",e:5}],"1#-1082432625":[{m:"Af1-e2",e:5}],"-1#-417167035":[{m:"Ra9-f9",e:5}],"1#540312011":[{m:"Rb1-b5",e:5}],"-1#2023404528":[{m:"c7-c6",e:5}],"1#-1141028661":[{m:"Eg1-e3",e:5}],"-1#1538248490":[{m:"g7-g6",e:6.667},{m:"Ra10-a9",e:6.667}],"1#787822679":[{m:"Af1-e2",e:5}],"-1#1991037597":[{m:"Hg8-f6",e:5}],"1#1140217451":[{m:"Ri1-i2",e:5}],"1#1846945398":[{m:"Ec1-e3",e:7.5}],"-1#-1344551781":[{m:"Ra10-b10",e:5}],"1#-1750472190":[{m:"Ri1-i2",e:5}],"-1#-1024612758":[{m:"Hh10-i8",e:5}],"-1#898413691":[{m:"Ra10-b10",e:5}],"1#234789602":[{m:"Ra1-b1",e:5}],"-1#995256862":[{m:"Rb10-b6",e:5}],"1#-1291841054":[{m:"Ra1-b1",e:5}],"-1#-2052267746":[{m:"Hb10-c8",e:5}],"1#-716223119":[{m:"Ec1-e3",e:9.412},{m:"Ri1-i2",e:9.412},{m:"Cb3-e3",e:9.412},{m:"Hb1-c3",e:9.412}],"-1#1739170648":[{m:"Hb10-c8",e:8.889},{m:"i7-i6",e:8.889},{m:"Ec10-e8",e:8.889}],"1#1991881188":[{m:"Ri1-i2",e:8},{m:"Hb1-d2",e:8}],"-1#-1526816543":[{m:"Ec10-e8",e:6.667}],"1#1749314951":[{m:"Ri1-i2",e:5}],"-1#1023418863":[{m:"i7-i6",e:8.333}],"1#294789388":[{m:"c4-c5",e:7.5}],"-1#-561963644":[{m:"c6xc5",e:7.5}],"1#1262199739":[{m:"Ri1-i2",e:7.5}],"-1#511700947":[{m:"i7-i6",e:8.333},{m:"Hh10-i8",e:8.333}],"1#-1778067409":[{m:"i4-i5",e:7.5}],"-1#-2146762471":[{m:"Hh10-g8",e:8.889},{m:"Ec10-e8",e:8.889},{m:"Hb10-c8",e:8.889},{m:"Cb8-e8",e:8.889}],"1#1121188436":[{m:"Ec1-e3",e:5}],"-1#-264956803":[{m:"Ri10-i9",e:5}],"1#-1314930663":[{m:"i4-i5",e:5}],"1#-1399258630":[{m:"Ri2-f2",e:8},{m:"Hb1-c3",e:8},{m:"Ri1-i2",e:7.5}],"1#-1860496475":[{m:"Ri2-d2",e:6.667},{m:"Ri1-i2",e:8}],"1#-1247594831":[{m:"Hb1-c3",e:5}],"-1#-402956804":[{m:"Hb10-c8",e:5}],"1#-152350912":[{m:"Ri2-f2",e:5}],"-1#2131745515":[{m:"Hb10-c8",e:6.667}],"1#1847576663":[{m:"Hb1-c3",e:6.667}],"1#-722449145":[{m:"Ri1-i2",e:8.571},{m:"Hb1-c3",e:8.571},{m:"g4-g5",e:8.571}],"-1#-2118909585":[{m:"Ch8-i8",e:6.667},{m:"g7-g6",e:6.667}],"1#-1135254628":[{m:"Ec1-e3",e:5}],"-1#246648245":[{m:"Ri10-h10",e:5}],"1#1425207364":[{m:"Ri2-d2",e:5}],"-1#-86025049":[{m:"Cb8-e8",e:5}],"1#-814257393":[{m:"Ad1-e2",e:5}],"-1#-2139194865":[{m:"Hb10-c8",e:5}],"1#-1855035213":[{m:"i4-i5",e:5}],"-1#795963603":[{m:"e7-e6",e:5}],"1#-1918696028":[{m:"Rd2-d5",e:5}],"1#-185666030":[{m:"Ec1-e3",e:5}],"-1#1174935611":[{m:"Eg10-e8",e:6.667},{m:"Ch8-i8",e:6.667}],"1#-2058017596":[{m:"g4-g5",e:6.667},{m:"c4-c5",e:6.667}],"-1#-912338391":[{m:"g6xg5",e:5}],"-1#1246107724":[{m:"Hb10-a8",e:5}],"1#2078898888":[{m:"Ri2-f2",e:5}],"-1#2000466098":[{m:"Ri10-h10",e:5}],"1#763219267":[{m:"Rf2-f5",e:5}],"-1#-781434395":[{m:"i7-i6",e:5}],"1#-561934534":[{m:"i4-i5",e:5}],"-1#-2035800502":[{m:"c7-c6",e:5}],"-1#-1740915734":[{m:"Cb8-e8",e:7.5},{m:"c7-c6",e:7.5}],"1#-1382839230":[{m:"Cb3-e3",e:5}],"-1#131275736":[{m:"Hb10-c8",e:5}],"1#381880676":[{m:"Hb1-c3",e:5}],"-1#1151033897":[{m:"Ra10-b10",e:5}],"1#2095664304":[{m:"Ra1-a2",e:5}],"-1#-173489125":[{m:"Rb10-b6",e:5}],"1#-2034582131":[{m:"Ra2-f2",e:5}],"-1#882390177":[{m:"g7-g6",e:5}],"1#1103283164":[{m:"Rf2-f7",e:5}],"1#1532772561":[{m:"Ec1-e3",e:6.667},{m:"Ri1-i2",e:6.667}],"-1#-373641480":[{m:"Hb10-c8",e:5}],"1#-123028412":[{m:"Ch3-g3",e:5}],"-1#-430661534":[{m:"Ri10-h10",e:5}],"1#-1139417709":[{m:"Ri1-i2",e:5}],"-1#236457145":[{m:"Hb10-c8",e:5}],"1#520625669":[{m:"Ri2-d2",e:5}],"-1#-1322929434":[{m:"Ch8-i8",e:5}],"1#121152758":[{m:"Ec1-e3",e:5}],"-1#-1243723041":[{m:"Hh10-g8",e:5}],"1#1996927378":[{m:"Ri1-i2",e:5}],"-1#574815738":[{m:"Ec10-e8",e:5}],"1#248577305":[{m:"c4-c5",e:5}],"-1#-1044135535":[{m:"Ad10-e9",e:5}],"1#755169632":[{m:"Hb1-c3",e:5}],"-1#2136642093":[{m:"Ra10-d10",e:5}],"1#-1183542457":[{m:"Ra1-a2",e:5}],"-1#808786924":[{m:"Ch8-i8",e:5}],"1#232028447":[{m:"Ri2-d2",e:5}],"-1#-1543907844":[{m:"Ri10-h10",e:5}],"1#-105338867":[{m:"Ch3-g3",e:5}],"-1#-414796757":[{m:"Rh10-h6",e:5}],"1#1116802417":[{m:"Rd2xd10+",e:5}],"-1#-2055217022":[{m:"Ae9xd10",e:5}],"1#-1679207508":[{m:"Ra2-d2",e:5}],"-1#1340969366":[{m:"c7-c6",e:5}],"1#-1937085779":[{m:"Rd2-d5",e:5}],"-1#-1781848903":[{m:"Ci8xi4",e:5}],"1#-776972250":[{m:"Cg3xg7",e:5}],"-1#-705686766":[{m:"Cb8-a8",e:5}],"1#485630162":[{m:"Cb3-b2",e:5}],"-1#-1459586258":[{m:"Hc8-b6",e:5}],"1#2002103391":[{m:"Ad1-e2",e:5}],"-1#945601887":[{m:"Af10-e9",e:5}],"1#888633805":[{m:"Cg7xa7",e:5}],"-1#439217420":[{m:"c6xc5",e:5}],"1#559234200":[{m:"Rd5xc5",e:5}],"-1#685486457":[{m:"Ke10-f10",e:5}],"1#1435735435":[{m:"a4-a5",e:5}],"-1#2080190663":[{m:"Rh6-c6",e:5}],"1#-1918705450":[{m:"Rc5xc6",e:5}],"-1#-515396699":[{m:"Ee8xc6",e:5}],"1#-548604705":[{m:"Ca7-b7",e:5}],"-1#451404491":[{m:"Ec6-e8",e:5}],"1#-1824541931":[{m:"Cb2-c2",e:5}],"-1#-222946000":[{m:"Hg8-f6",e:5}],"1#1355270531":[{m:"g4-g5",e:5}],"-1#470564718":[{m:"Hb6-c4",e:5}],"1#867038363":[{m:"Cb7-b10+",e:5}],"-1#1591359149":[{m:"Ee8-c10",e:5}],"1#1917335118":[{m:"e4-e5",e:5}],"-1#-171453694":[{m:"Ca8-c8",e:5}],"1#-1377395247":[{m:"Cc2xc4",e:5}],"-1#1620560764":[{m:"Cc8xc3",e:5}],"1#-2011943338":[{m:"Cc4-f4+",e:5}],"-1#-1543680157":[{m:"Hf6-d7",e:5}],"1#-820308448":[{m:"Cb10-b7",e:5}],"-1#-1569926122":[{m:"Cc3xi3",e:5}],"1#-189974578":[],"1#985314985":[{m:"c4-c5",e:5}],"1#1967245169":[{m:"Cb3-e3",e:7.5},{m:"Hb1-c3",e:7.5}],"-1#-553561877":[{m:"Hh10-g8",e:6.667}],"1#500804518":[{m:"Hb1-c3",e:6.667}],"-1#655993916":[{m:"Hh10-g8",e:5}],"1#-440313999":[{m:"Ri1-i2",e:5}],"-1#-1333454055":[{m:"Hb10-a8",e:5}],"1#-99460325":[{m:"Ri2-f2",e:5}],"-1#-154693279":[{m:"i7-i6",e:5}],"1#-114663490":[{m:"Rf2-f7",e:5}],"-1#571788105":[{m:"Ri10-h10",e:5}],"1#2018883256":[{m:"Rf7xg7",e:5}],"-1#655651968":[{m:"Cb8-c8",e:5}],"1#-1410711838":[{m:"Ch3-f3",e:5}],"-1#-1900648357":[{m:"Ra10-b10",e:5}],"1#-1228650814":[{m:"Ra1-b1",e:5}],"-1#-2140621250":[{m:"Rb10-b4",e:5}],"1#2102349791":[{m:"Ec1-e3",e:5}],"-1#-810966538":[{m:"c7-c6",e:5}],"1#214850253":[{m:"Rg7-g5",e:5}],"-1#1586321205":[{m:"Rh10-h6",e:5}],"1#-77926801":[{m:"Ad1-e2",e:5}],"-1#-1269563537":[{m:"Ha8-c7",e:5}],"1#-1324274922":[{m:"Cb3-a3",e:5}],"-1#-2104548742":[{m:"Rb4xc4",e:5}],"1#-426521955":[{m:"Rg5-d5",e:5}],"-1#-1809430535":[{m:"c6-c5",e:5}],"1#437022104":[{m:"Rd5-d8",e:5}],"-1#-1065133899":[{m:"Cc8-a8",e:5}],"1#-1734207898":[{m:"Ca3-a2",e:5}],"-1#1341297326":[{m:"Hc7-d5",e:5}],"1#267606895":[{m:"Ca2-c2",e:5}],"-1#580588643":[{m:"Hd5xc3",e:5}],"1#-1826933632":[{m:"Cc2xc4",e:5}],"-1#139526552":[{m:"Hc3xb1",e:5}],"1#432371861":[{m:"Hb1-c3",e:8},{m:"Cb3-e3",e:8}],"-1#1268585432":[{m:"c7-c6",e:6.667},{m:"Ec10-e8",e:6.667}],"1#-1996822301":[{m:"Ri1-i2",e:5}],"-1#-574708597":[{m:"Hb10-c8",e:5}],"1#1729041211":[{m:"c4-c5",e:5}],"-1#-1474547789":[{m:"Hh10-i8",e:5}],"1#543627343":[{m:"Ec1-e3",e:5}],"-1#-1836976538":[{m:"Ri10-i9",e:5}],"1#-752147966":[{m:"Ad1-e2",e:5}],"-1#-1675480318":[{m:"Ri9-d9",e:5}],"1#1663474365":[{m:"Ri1-i2",e:5}],"-1#912447189":[{m:"Ad10-e9",e:5}],"1#-626790876":[{m:"Ri2-f2",e:5}],"-1#-696900514":[{m:"Hb10-c8",e:5}],"1#-949602590":[{m:"Rf2-f6",e:5}],"-1#-2032027800":[{m:"Ra10-d10",e:5}],"1#1087354370":[{m:"Rf6xi6",e:5}],"-1#-323811993":[{m:"Rd9-d6",e:5}],"1#112359268":[{m:"i4-i5",e:5}],"-1#-1283068145":[{m:"Cb8-e8",e:6.667},{m:"Hb10-c8",e:6.667}],"1#-2043815769":[{m:"Hb1-c3",e:5}],"-1#-730483734":[{m:"Hb10-c8",e:5}],"1#-983195306":[{m:"Ra1-a2",e:5}],"-1#1277438461":[{m:"Ra10-b10",e:5}],"1#1951795044":[{m:"Ra2-f2",e:5}],"-1#-965439928":[{m:"Ad10-e9",e:5}],"1#716551865":[{m:"Rf2-f6",e:5}],"-1#1866531475":[{m:"Rb10-b4",e:5}],"1#-1838744718":[{m:"g4-g5",e:5}],"-1#-559084129":[{m:"Rb4xc4",e:5}],"1#-1162746504":[{m:"g5-g6",e:5}],"-1#-658675093":[{m:"g7xg6",e:5}],"1#-1814610176":[{m:"Rf6xg6",e:5}],"-1#-735312088":[{m:"Ch8-g8",e:5}],"1#-1567228493":[{m:"Hb1-c3",e:5}],"-1#-254961922":[{m:"Ra10-b10",e:5}],"1#-926959513":[{m:"Ra1-b1",e:5}],"-1#-32290661":[{m:"Ad10-e9",e:5}],"1#315781226":[{m:"Rb1-b5",e:5}],"-1#1249657425":[{m:"Hh10-i8",e:5}],"1#-1039698515":[{m:"i4-i5",e:5}],"-1#2081975757":[{m:"i6xi5",e:5}],"1#1581404870":[{m:"Rb5xi5",e:5}],"-1#-580457543":[{m:"Cb8-a8",e:5}],"1#342153337":[{m:"Ri1-i2",e:5}],"-1#1092654097":[{m:"Rb10-b4",e:5}],"1#-1140363792":[{m:"c4-c5",e:5}],"-1#1930711416":[{m:"c7-c6",e:5}],"1#-1334597053":[{m:"Ce3-f3",e:5}],"-1#1476353214":[{m:"Cb8-e8",e:9.714},{m:"c7-c6",e:9.714},{m:"Ec10-e8",e:9.714},{m:"Ch8-e8",e:9.714},{m:"g7-g6",e:9.714},{m:"Cb8-f8",e:9.714},{m:"Ch8-d8",e:9.714},{m:"Hh10-g8",e:9.714}],"1#1649896214":[{m:"Hb1-c3",e:6.667}],"-1#806289499":[{m:"c7-c6",e:6.667},{m:"Hb10-c8",e:6.667}],"1#-211223712":[{m:"Ra1-b1",e:5}],"-1#-977007716":[{m:"Hb10-c8",e:5}],"1#-724297440":[{m:"g4-g5",e:5}],"-1#-1742737459":[{m:"Ra10-b10",e:5}],"1#-1603419820":[{m:"Hh1-g3",e:5}],"-1#-271553380":[{m:"Hh10-i8",e:5}],"1#1739283296":[{m:"Eg1-e3",e:5}],"-1#-516792910":[{m:"Ch8-f8",e:7.5},{m:"Ch8-h4",e:7.5}],"1#573245339":[{m:"Ri1-f1",e:6.667},{m:"Ri1-h1",e:6.667}],"-1#258449233":[{m:"Af10-e9",e:5}],"1#63724483":[{m:"Cb3-b5",e:5}],"-1#881134461":[{m:"Rb10-b6",e:5}],"-1#683039915":[{m:"Ri10-h10",e:5}],"1#1928798554":[{m:"Ch3-h7",e:5}],"-1#113623008":[{m:"i7-i6",e:5}],"1#153645375":[{m:"Cb3-b7",e:5}],"1#-994351400":[{m:"Hg3-h5",e:6.667},{m:"Ri1-f1",e:6.667}],"-1#-180866727":[{m:"Rb10-b4",e:5}],"1#136300728":[{m:"Ri1-f1",e:6.667},{m:"Cc3-c4",e:6.667}],"-1#-369623534":[{m:"Ch4xc4",e:5}],"1#277791898":[{m:"Ch3-h5",e:5}],"-1#1624345241":[{m:"Ri10-i9",e:5}],"1#555684583":[{m:"c4-c5",e:5}],"-1#-301191569":[{m:"Hh10-i8",e:5}],"1#1719081363":[{m:"Hh1-g3",e:5}],"-1#701150299":[{m:"Ch8-g8",e:5}],"1#1597086353":[{m:"Ra1-b1",e:5}],"-1#1771924077":[{m:"Ra10-b10",e:5}],"1#1374635252":[{m:"Ri1-h1",e:5}],"-1#1534205892":[{m:"Ri10-h10",e:5}],"1#20144693":[{m:"Ch3-h5",e:5}],"-1#1902914614":[{m:"Rb10-b4",e:5}],"1#-1941187113":[{m:"Hc3-d5",e:5}],"-1#-1509413910":[{m:"Rh10-h6",e:5}],"1#64983728":[{m:"Eg1-e3",e:5}],"-1#-2058972062":[{m:"i7-i6",e:5}],"1#-1968481603":[{m:"g4-g5",e:5}],"-1#-966742960":[{m:"Rb4-b6",e:5}],"1#1434983254":[{m:"Hd5xc7",e:5}],"-1#-985708014":[{m:"g7-g6",e:5}],"1#-1335509649":[{m:"g5xg6",e:5}],"-1#-615996039":[{m:"Rh6xg6",e:5}],"1#1999167130":[{m:"Hg3-f5",e:5}],"-1#567971325":[{m:"Ce8xe4",e:5}],"1#1672991820":[{m:"Cb3-b5",e:5}],"-1#1425966322":[{m:"Rg6-g4",e:5}],"1#1764886880":[{m:"Rb1-b4",e:5}],"-1#961837626":[{m:"Rb6-g6",e:5}],"1#-1801934971":[{m:"Ch3-c3",e:8.333},{m:"g4-g5",e:8.333},{m:"Cb3-c3",e:8.333}],"-1#-1449951133":[{m:"Ec10-e8",e:5}],"1#-2063499136":[{m:"Ri1-i3",e:5}],"-1#551449276":[{m:"i7-i6",e:5}],"1#791919715":[{m:"g4-g5",e:5}],"-1#1677216398":[{m:"Hh10-i8",e:5}],"1#-343704206":[{m:"Ri3-d3",e:5}],"-1#1909783090":[{m:"Ri10-h10",e:5}],"1#731219907":[{m:"Hh1-g3",e:5}],"-1#1680353803":[{m:"Hb10-c8",e:5}],"1#1966618807":[{m:"Ec1-e3",e:5}],"-1#-941697378":[{m:"Ch8-f8",e:5}],"1#80186551":[{m:"Hb1-d2",e:5}],"-1#-696214094":[{m:"Rh10-h6",e:5}],"1#1935090920":[{m:"Ra1-c1",e:5}],"-1#-686533980":[{m:"Ad10-e9",e:5}],"1#1003842133":[{m:"e4-e5",e:5}],"-1#-1134915815":[{
m:"Ra10-d10",e:5}],"1#2054458995":[{m:"Rd3xd10+",e:5}],"-1#-665628312":[{m:"Hb10-c8",e:7.5}],"1#-918338604":[{m:"Hh1-g3",e:7.5}],"-1#-2030113252":[{m:"Hh10-i8",e:8},{m:"Hb10-c8",e:5},{m:"Ch8-e8",e:8}],"1#243653088":[{m:"Hb1-a3",e:6.667},{m:"Hb1-c3",e:6.667}],"-1#291202488":[{m:"Ec10-e8",e:5}],"1#1036608859":[{m:"Eg1-e3",e:5}],"-1#1558033069":[{m:"Ec10-e8",e:5}],"1#1143346513":[{m:"Hb1-a3",e:6.667},{m:"Eg1-e3",e:6.667}],"-1#1543022857":[{m:"Ra10-a9",e:5}],"1#1134637128":[{m:"Eg1-e3",e:5}],"-1#-1027665021":[{m:"Cb8-a8",e:5}],"1#196943939":[{m:"Hb1-a3",e:5}],"1#-443048153":[{m:"Hb1-c3",e:5}],"-1#-1211108246":[{m:"Hh10-g8",e:5}],"1#1964445479":[{m:"Cb3-b5",e:5}],"-1#1113481113":[{m:"Ra10-a9",e:5}],"1#1510459096":[{m:"Eg1-e3",e:5}],"-1#-593575926":[{m:"Ra9-f9",e:5}],"-1#-1636793188":[{m:"Eg10-e8",e:5}],"1#1563277411":[{m:"Hb1-a3",e:5}],"-1#1123222587":[{m:"Hb10-c8",e:5}],"1#1407391367":[{m:"Ra1-b1",e:5}],"-1#1699735163":[{m:"Ra10-b10",e:5}],"1#1564330210":[{m:"Rb1-b7",e:5}],"-1#2112447297":[{m:"Cb8-a8",e:5}],"1#-1259646847":[{m:"Rb7-c7",e:5}],"-1#1312166255":[{m:"Ch8-f8",e:5}],"1#-1926280378":[{m:"Ch3-e3",e:5}],"-1#-675757406":[{m:"Hh10-f9",e:5}],"1#551137185":[{m:"Ri1-i3",e:5}],"-1#-2063180387":[{m:"Ri10-h10",e:5}],"1#-548986772":[{m:"Ri3-f3",e:5}],"-1#-48597189":[{m:"Af10-e9",e:5}],"1#-240012375":[{m:"Hh1-g3",e:5}],"-1#-1106502047":[{m:"Rh10-h4",e:5}],"1#2051928374":[{m:"c4-c5",e:5}],"1#2070764637":[{m:"Cb3-f3",e:7.5},{m:"Cb3-d3",e:7.5}],"-1#503518002":[{m:"Hb10-c8",e:5}],"1#252903822":[{m:"Hb1-c3",e:5}],"-1#1565223619":[{m:"Ra10-b10",e:5}],"1#1698251866":[{m:"Ra1-b1",e:5}],"-1#1402320038":[{m:"g7-g6",e:5}],"1#651117531":[{m:"Rb1-b5",e:5}],"-1#2120315360":[{m:"Cb8-a8",e:5}],"1#-1218231776":[{m:"Rb5-f5",e:5}],"-1#997740411":[{m:"Hh10-g8",e:5}],"1#-106908618":[{m:"Eg1-e3",e:5}],"-1#2134487780":[{m:"Rb10-b6",e:5}],"1#204196722":[{m:"Hh1-f2",e:5}],"-1#981338595":[{m:"Ch8-i8",e:5}],"1#127888144":[{m:"Ch3-h1",e:5}],"-1#974549603":[{m:"Ri10-h10",e:5}],"1#1616318354":[{m:"Cf3-h3",e:5}],"-1#-945693089":[{m:"Rh10-i10",e:5}],"1#-1646222418":[{m:"Ch1-f1",e:5}],"-1#345222694":[{m:"Ri10-h10",e:5}],"1#1322439639":[{m:"Ri1-g1",e:5}],"-1#789560202":[{m:"Ad10-e9",e:5}],"1#-1009876101":[{m:"g4-g5",e:5}],"-1#-1895467626":[{m:"Rh10-h6",e:5}],"1#718458060":[{m:"i4-i5",e:5}],"-1#-1798450004":[{m:"i7-i6",e:5}],"1#-1692394893":[{m:"i5xi6",e:5}],"-1#1102910374":[{m:"c7-c6",e:6.667}],"1#-2099582819":[{m:"Hb1-a3",e:6.667}],"-1#-1660660539":[{m:"Hb10-c8",e:6.667}],"1#-1944828295":[{m:"Ra1-b1",e:6.667}],"-1#-1162299771":[{m:"Ra10-b10",e:6.667}],"1#-2100652004":[{m:"Rb1-b5",e:6.667}],"-1#-630937049":[{m:"Cb8-a8",e:6.667}],"1#325491175":[{m:"Rb5-d5",e:6.667}],"-1#962617253":[{m:"Hh10-g8",e:6.667},{m:"Ch8-f8",e:6.667}],"1#-71785240":[{m:"Hh1-g3",e:5}],"-1#-1274738400":[{m:"Ch8-i8",e:5}],"1#-1981518893":[{m:"Ri1-h1",e:5}],"-1#-2089209629":[{m:"Ri10-h10",e:5}],"1#-650621678":[{m:"g4-g5",e:5}],"-1#-1779188737":[{m:"Rh10-h6",e:5}],"1#807666341":[{m:"Ch3-i3",e:5}],"-1#1201655226":[{m:"Rh6xh1",e:5}],"1#-92732020":[{m:"Hh1-g3",e:5}],"-1#-1245403068":[{m:"Hh10-g8",e:5}],"1#1998344969":[{m:"g4-g5",e:5}],"-1#1003988452":[{m:"Ri10-h10",e:5}],"1#1637275669":[{m:"g5-g6",e:5}],"-1#60446470":[{m:"g7xg6",e:5}],"1#1223688813":[{m:"Hg3-h5",e:5}],"-1#2037601772":[{m:"Rh10-i10",e:5}],"1#590489629":[{m:"Ch3-g3",e:5}],"1#882257285":[{m:"Hh1-g3",e:5}],"-1#2066448461":[{m:"g7-g6",e:5}],"1#242317104":[{m:"Eg1-e3",e:5}],"-1#-1998032414":[{m:"Hh10-g8",e:5}],"1#1244695215":[{m:"Ri1-f1",e:5}],"-1#1736184421":[{m:"Ri10-h10",e:5}],"1#1027436436":[{m:"Ch3-h1",e:5}],"-1#11826919":[{m:"Hb10-c8",e:5}],"1#295986267":[{m:"Hb1-a3",e:5}],"-1#242931715":[{m:"Cb8-a8",e:5}],"1#-948376637":[{m:"Ra1-b1",e:5}],"-1#-237757633":[{m:"Ra10-b10",e:5}],"1#-911854170":[{m:"Rf1-f7",e:5}],"-1#2073594104":[{m:"c7-c6",e:5}],"1#-1191218237":[{m:"Rf7-f5",e:5}],"-1#-2113053469":[{m:"e7-e6",e:5}],"1#551496084":[{m:"Ch1-g1",e:5}],"-1#858777318":[{m:"Hg8-e7",e:5}],"1#-881623353":[{m:"Rf5-f7",e:5}],"-1#-243183129":[{m:"a7-a6",e:5}],"1#-173847323":[{m:"g4-g5",e:5}],"-1#-1184318968":[{m:"Rb10-b6",e:5}],"1#-897924194":[{m:"g5xg6",e:5}],"-1#-1588077688":[{m:"Ca8-a7",e:5}],"1#2142865499":[{m:"Rf7-f3",e:5}],"-1#2056536021":[{m:"Hc8-d6",e:5}],"1#1344705622":[{m:"g6-f6",e:5}],"-1#1264402050":[{m:"Hd6xe4",e:5}],"1#1238507183":[{m:"Cb3-d3",e:5}],"-1#1929531732":[{m:"Rb6xb1",e:5}],"1#-773757854":[{m:"Ha3xb1",e:5}],"-1#96266456":[{m:"e6-e5",e:5}],"1#-377688980":[{m:"f6-f7",e:5}],"-1#-715585015":[{m:"He7-d5",e:5}],"1#-773354154":[{m:"f7-f8",e:5}],"-1#2082188129":[{m:"Ce8-b8",e:5}],"1#-1948430082":[{m:"Rf3-f6",e:5}],"-1#340390413":[{m:"Af10-e9",e:5}],"1#417478303":[{m:"Hg3-f1",e:5}],"-1#-1416000534":[{m:"Hd5-b4",e:5}],"1#791288905":[{m:"Hb1-a3",e:5}],"-1#821338129":[{m:"Rh10-h7",e:5}],"1#417488126":[{m:"f8-f9",e:5}],"-1#-968591277":[{m:"e5-d5",e:5}],"1#1309128239":[{m:"Rf6-e6",e:5}],"-1#-1002720480":[{m:"Rh7-f7",e:5}],"1#1749853851":[{m:"Cd3xd10",e:5}],"-1#-1845627527":[{m:"Cb8-e8",e:5}],"1#1715146470":[{m:"Cd10-d9",e:5}],"-1#-2017195542":[{m:"Ca7-e7",e:5}],"1#267244270":[{m:"Re6-g6",e:5}],"-1#1767863032":[{m:"Eg10-i8",e:5}],"1#929790354":[{m:"Rg6-g8",e:5}],"-1#1341674160":[{m:"Ae9-f8",e:5}],"1#418495914":[{m:"Rg8-g9",e:5}],"1#581282755":[{m:"Cb3-g3",e:9.286},{m:"c4-c5",e:9.286},{m:"Ch3-d3",e:9.286},{m:"Cb3-f3",e:9.286},{m:"Ch3-g3",e:9.286}],"-1#1704760815":[{m:"Eg10-e8",e:5}],"1#-1497257712":[{m:"Ra1-a3",e:5}],"-1#-993160775":[{m:"Hh10-g8",e:5}],"1#102066932":[{m:"Ra3-f3",e:5}],"-1#1758601562":[{m:"Hb10-a8",e:5}],"1#574972248":[{m:"Hb1-c3",e:5}],"-1#1880951317":[{m:"Ra10-b10",e:5}],"1#1215243404":[{m:"Eg1-e3",e:5}],"-1#-822730146":[{m:"Cb8-d8",e:5}],"1#-1548503379":[{m:"Hh1-f2",e:5}],"-1#-306800821":[{m:"Hh10-g8",e:5}],"1#795765766":[{m:"Hh1-g3",e:5}],"-1#1624490446":[{m:"Eg10-e8",e:5}],"1#-1550910159":[{m:"Eg1-e3",e:5}],"-1#622328803":[{m:"Hb10-a8",e:5}],"1#1870707681":[{m:"Hb1-c3",e:5}],"-1#1037619372":[{m:"Af10-e9",e:6.667},{m:"Ra10-a9",e:6.667}],"1#829625406":[{m:"Ri1-f1",e:5}],"1#629230061":[{m:"Ri1-f1",e:5}],"-1#-1578648037":[{m:"Hh10-g8",e:6.667}],"1#1665090902":[{m:"Hh1-g3",e:6.667},{m:"c4-c5",e:6.667}],"-1#746776734":[{m:"Ri10-h10",e:5}],"1#1992529263":[{m:"Eg1-e3",e:6.667}],"-1#-262499395":[{m:"Eg10-e8",e:8}],"-1#-1406371362":[{m:"Cb8-c8",e:5}],"1#550646716":[{m:"Eg1-e3",e:5}],"-1#-1505020562":[{m:"Hb10-a8",e:5}],"1#-321096340":[{m:"Hb1-c3",e:5}],"-1#1204544684":[{m:"Hb10-c8",e:5}],"1#1457255952":[{m:"Hb1-c3",e:5}],"-1#75734365":[{m:"Ra10-b10",e:5}],"1#1022473156":[{m:"Hh1-i3",e:5}],"-1#629126138":[{m:"Hh10-g8",e:5}],"1#-408467273":[{m:"Eg1-e3",e:5}],"-1#1631473253":[{m:"Af10-e9",e:5}],"1#1838516983":[{m:"Ra1-b1",e:5}],"-1#1530493451":[{m:"Cb8-b4",e:5}],"1#-420203761":[{m:"g4-g5",e:5}],"-1#1012643813":[{m:"Hh10-i8",e:8.889},{m:"Eg10-e8",e:8.889},{m:"Ec10-e8",e:8.889}],"1#-1272938471":[{m:"c4-c5",e:5}],"-1#2066988177":[{m:"Ec10-e8",e:5}],"1#1470217330":[{m:"Cb3-e3",e:5}],"1#-16348390":[{m:"Hh1-i3",e:6.667}],"-1#-427259100":[{m:"Hh10-g8",e:6.667}],"1#281655046":[{m:"Hh1-i3",e:8.333}],"-1#155694904":[{m:"Hh10-g8",e:8.333},{m:"Hh10-i8",e:8.333}],"1#1701960526":[{m:"Hb1-c3",e:6.667},{m:"c4-c5",e:6.667}],"-1#925478915":[{m:"Hb10-c8",e:5}],"1#641311423":[{m:"Ra1-b1",e:5}],"-1#278221379":[{m:"c7-c6",e:5}],"1#-739071624":[{m:"Cb3-a3",e:5}],"-1#-529752044":[{m:"Hh10-g8",e:5}],"1#582245209":[{m:"g4-g5",e:5}],"-1#1853861300":[{m:"Ch8-h4",e:5}],"1#1274451678":[{m:"Hh1-g3",e:5}],"-1#72039190":[{m:"Ch4xc4",e:5}],"1#-47054434":[{m:"Ec1-e3",e:5}],"-1#1339355063":[{m:"Ri10-h10",e:5}],"1#362123846":[{m:"Ri1-h1",e:5}],"-1#520669558":[{m:"Rh10-h6",e:5}],"1#-1159761876":[{m:"Ch3-i3",e:5}],"-1#-849035469":[{m:"Rh6xh1",e:5}],"1#1293136806":[{m:"Hg3xh1",e:5}],"-1#1092372733":[{m:"Ra10-a9",e:5}],"1#1497747900":[{m:"Ci3-g3",e:5}],"-1#769471988":[{m:"Eg10-e8",e:5}],"1#-293598965":[{m:"Rb1-b5",e:5}],"-1#-1238484176":[{m:"Ra9-h9",e:5}],"1#-1029665545":[{m:"Hh1-i3",e:5}],"-1#-617706295":[{m:"Rh9-h6",e:5}],"1#-1483555975":[{m:"i4-i5",e:5}],"-1#428712729":[{m:"Af10-e9",e:5}],"1#354838411":[{m:"a4-a5",e:5}],"-1#-1436358714":[{m:"Hb10-c8",e:5}],"1#-1150093958":[{m:"Hb1-c3",e:5}],"-1#-383082953":[{m:"Ra10-b10",e:5}],"1#-782716754":[{m:"Ra1-b1",e:5}],"-1#-403423150":[{m:"Rb10-b6",e:5}],"1#-1796851260":[{m:"Cb3-a3",e:5}],"-1#-1485295448":[{m:"Rb6xb1",e:5}],"1#94045598":[{m:"Hc3xb1",e:5}],"-1#-1673503183":[{m:"g7-g6",e:5}],"1#-384128692":[{m:"Ch3-g3",e:5}],"-1#-136006294":[{m:"Eg10-e8",e:5}],"1#884574613":[{m:"Hh1-i3",e:5}],"-1#758614443":[{m:"Ch8-h4",e:5}],"1#146715329":[{m:"Hb1-c3",e:5}],"-1#1525078412":[{m:"Hh10-g8",e:5}],"1#-1740758335":[{m:"Hc3-d5",e:5}],"-1#-1300374276":[{m:"Ch4xe4+",e:5}],"1#878690372":[{m:"Eg1-e3",e:5}],"-1#-1295595882":[{m:"Hg8-h6",e:5}],"1#789523993":[{m:"Ri1-f1",e:5}],"-1#37992147":[{m:"Af10-e9",e:5}],"1#250114625":[{m:"Rf1-f4",e:5}],"-1#-211411796":[{m:"Ce4-e6",e:5}],"1#563505275":[{m:"Hd5xc7",e:5}],"-1#-1323222721":[{m:"i7-i6",e:5}],"1#-1093863456":[{m:"Ca3-c3",e:5}],"-1#-1704465692":[{m:"i6-i5",e:5}],"1#1074591091":[{m:"Hh1-g3",e:8},{m:"g4-g5",e:8},{m:"Ch3-e3",e:8}],"-1#263280827":[{m:"Hh10-g8",e:5}],"1#-848714762":[{m:"Ri1-h1",e:5}],"-1#-940246842":[{m:"Eg10-e8",e:5}],"1#78234681":[{m:"c4-c5",e:5}],"-1#-876939087":[{m:"Af10-e9",e:5}],"1#-955171805":[{m:"Hb1-c3",e:5}],"-1#-1790355602":[{m:"Hb10-a8",e:5}],"1#-539093140":[{m:"Hc3-d5",e:5}],"-1#-174200495":[{m:"Ri10-f10",e:5}],"1#2085183125":[{m:"Cb3-e3",e:5}],"-1#-704001777":[{m:"Cd8-d6",e:5}],"1#-116422053":[{m:"Ra1-a3",e:5}],"-1#-1694256398":[{m:"Ra10-b10",e:5}],"1#-1552835477":[{m:"Ce3-d3",e:5}],"-1#775713659":[{m:"Cd6-g6",e:5}],"1#516847078":[{m:"Eg1-e3",e:5}],"-1#-1739099340":[{m:"Cb8-b3",e:5}],"1#-1232251908":[{m:"Hg3-f1",e:5}],"-1#214369182":[{m:"Hh10-g8",e:6.667}],"1#-836765485":[{m:"Hh1-g3",e:6.667},{m:"Ch3-d3",e:6.667}],"-1#-2120067813":[{m:"Ri10-h10",e:5}],"1#-605869846":[{m:"Ri1-h1",e:5}],"-1#-780241958":[{m:"Rh10-h6",e:5}],"1#1957284480":[{m:"Cb3-f3",e:5}],"-1#298288623":[{m:"g7-g6",e:5}],"1#1688040082":[{m:"g5xg6",e:5}],"-1#263219844":[{m:"Rh6xg6",e:5}],"-1#1298001163":[{m:"Ri10-h10",e:5}],"1#387748090":[{m:"Hh1-g3",e:5}],"-1#1486961970":[{m:"Hb10-c8",e:5}],"1#1236348814":[{m:"Hb1-a3",e:5}],"-1#1450152918":[{m:"Ec10-e8",e:5}],"1#2063438645":[{m:"Cb3-c3",e:5}],"-1#1880469548":[{m:"Ra10-b10",e:5}],"1#1214750389":[{m:"Ra1-b1",e:5}],"-1#446397591":[{m:"Hh10-g8",e:5}],"1#-666662950":[{m:"Hh1-g3",e:5}],"-1#-1744950766":[{m:"Ri10-h10",e:5}],"1#-843098141":[{m:"Hb1-a3",e:5}],"-1#-765334597":[{m:"Ec10-e8",e:5}],"1#-17568936":[{m:"Cb3-c3",e:5}],"-1#-199505855":[{m:"Hb10-a8",e:5}],"1#-1098086333":[{m:"Ra1-b1",e:5}],"-1#-2011137857":[{m:"Ra10-b10",e:5}],"1#-1336781274":[{m:"Rb1-b5",e:5}],"-1#-386112483":[{m:"a7-a6",e:5}],"1#-320964321":[{m:"g4-g5",e:5}],"-1#-1609199630":[{m:"Cb8-c8",e:5}],"1#753649040":[{m:"Rb5-d5",e:5}],"-1#116196306":[{m:"Ad10-e9",e:5}],"1#-366200029":[{m:"Hg3-f5",e:5}],"-1#-1126275004":[{m:"Rh10-h6",e:5}],"1#-1792563213":[{m:"g4-g5",e:8},{m:"Hb1-a3",e:8}],"-1#-638824162":[{m:"c7-c6",e:7.5},{m:"Ch8-i8",e:7.5}],"1#445360677":[{m:"Hh1-g3",e:6.667},{m:"Hb1-a3",e:6.667}],"-1#1429604333":[{m:"Hb10-c8",e:5}],"-1#89462397":[{m:"Hb10-c8",e:5}],"1#340067521":[{m:"Ra1-a2",e:5}],"-1#-1660646294":[{m:"Ch8-i8",e:5}],"1#-1595543911":[{m:"Ra2-d2",e:5}],"-1#1960914083":[{m:"Ri10-h10",e:5}],"1#-468896787":[{m:"Ch3-f3",e:5}],"-1#-1051630252":[{m:"Ri10-h10",e:5}],"1#-1693443931":[{m:"Hh1-g3",e:5}],"-1#-726813331":[{m:"Hb10-c8",e:5}],"1#-977426479":[{m:"c4-c5",e:5}],"-1#179215193":[{m:"Cb8-a8",e:5}],"1#-1012094823":[{m:"Cb3-e3",e:5}],"-1#1777090307":[{m:"Ra10-b10",e:5}],"1#1369313690":[{m:"Hb1-c3",e:5}],"-1#63339223":[{m:"Rh10-h6",e:5}],"1#-1508785267":[{m:"Ri1-h1",e:5}],"-1#-1400072003":[{m:"Rb10-b6",e:5}],"-1#-1963385941":[{m:"g7-g6",e:5}],"1#-6034218":[{m:"Cb3-c3",e:5}],"-1#-179580977":[{m:"Hb10-a8",e:5}],"1#-1076064307":[{m:"Ra1-b1",e:5}],"-1#-1989116111":[{m:"Ra10-b10",e:5}],"1#-1325248088":[{m:"g4-g5",e:5}],"-1#-37116091":[{m:"g6xg5",e:5}],"1#1728933746":[{m:"Rb1-b5",e:5}],"-1#1067670857":[{m:"g5-g4",e:5}],"1#-1506517800":[{m:"Eg1-e3",e:5}],"-1#548231690":[{m:"Cb8-c8",e:5}],"1#-1403842456":[{m:"Rb5-g5",e:5}],"-1#-2137099907":[{m:"Hg8-f6",e:5}],"1#586130894":[{m:"Hh1-f2",e:5}],"-1#347760479":[{m:"g4-f4",e:5}],"1#-130292057":[{m:"Ch3-i3",e:5}],"-1#-1887426120":[{m:"Eg10-e8",e:5}],"1#1289557319":[{m:"Ri1-h1",e:5}],"-1#1178619511":[{m:"a7-a6",e:5}],"1#1113740149":[{m:"i4-i5",e:5}],"-1#-58897643":[{m:"Rb10-b6",e:5}],"1#-1888537981":[{m:"i5-i6",e:5}],"-1#-2122914194":[{m:"Af10-e9",e:5}],"1#-1914887428":[{m:"Rh1-h6",e:5}],"-1#1004828328":[{m:"Ri10-f10",e:5}],"1#-1305427604":[{m:"Ci3xi7",e:5}],"-1#-1931172948":[{m:"Cb8-f8",e:9.994},{m:"g7-g6",e:9.994},{m:"Ch8-d8",e:9.994},{m:"Hb10-a8",e:9.994},{m:"Ec10-e8",e:9.994},{m:"i7-i6",e:9.994},{m:"c7-c6",e:9.994},{m:"Ch8-f8",e:9.994},{m:"Ch8-e8",e:9.994},{m:"Hh10-g8",e:9.994},{m:"Cb8-d8",e:9.994},{m:"Ch8-c8",e:9.994},{m:"Hb10-c8",e:9.994},{m:"Cb8-e8",e:9.994},{m:"Eg10-e8",e:9.994},{m:"Hh10-i8",e:9.994},{m:"Ch8-g8",e:9.994},{m:"Ri10-i9",e:9.994},{m:"Ri10-i8",e:9.994}],"1#-1100340132":[{m:"Hh1-g3",e:8.333},{m:"c4-c5",e:8.333}],"-1#-237532780":[{m:"Hh10-i8",e:7.5}],"1#2041364072":[{m:"Ri1-h1",e:7.5},{m:"Hb1-c3",e:7.5}],"-1#1932649816":[{m:"Ri10-h10",e:6.667}],"1#695244969":[{m:"Hb1-a3",e:6.667},{m:"c4-c5",e:6.667}],"-1#-429677535":[{m:"Hb10-c8",e:5}],"-1#737465637":[{m:"Hb10-c8",e:5}],"1#988071833":[{m:"Ra1-b1",e:5}],"-1#206059365":[{m:"Ri10-h10",e:5}],"-1#1903761620":[{m:"Hb10-c8",e:6.667}],"1#1617496680":[{m:"Hb1-c3",e:6.667}],"-1#842096933":[{m:"Ra10-b10",e:6.667}],"1#172183484":[{m:"Ra1-b1",e:6.667}],"-1#1022345024":[{m:"Rb10-b4",e:6.667},{m:"Hh10-i8",e:6.667}],"1#-1043839327":[{m:"Cb3-a3",e:5}],"-1#-229224499":[{m:"Rb4-c4",e:5}],"1#-1265334084":[{m:"Hh1-g3",e:5}],"-1#-81189516":[{m:"Rb10-b4",e:5}],"1#-104966959":[{m:"Hb1-c3",e:9.961},{m:"c4-c5",e:9.961},{m:"Hh1-g3",e:9.961}],"-1#-1410973796":[{m:"c7-c6",e:5}],"1#1753334951":[{m:"Hh1-g3",e:5}],"-1#658270575":[{m:"Cb8-c8",e:5}],"1#-1413340403":[{m:"Ri1-h1",e:5}],"-1#-1587578819":[{m:"Hh10-g8",e:5}],"1#1669825392":[{m:"Cb3-b8",e:5}],"-1#1802194817":[{m:"Ri10-h10",e:5}],"-1#-1241253607":[{m:"g7-g6",e:7.5},{m:"Ch8-e8",e:9.96},{m:"Ch8-d8",e:9.96},{m:"c7-c6",e:9.96},{m:"g7-g6",e:9.986},{m:"Ri10-i9",e:9.96}],"1#1964679984":[{m:"Ri1-h1",e:9.091}],"-1#2139617280":[{m:"g7-g6",e:5}],"1#-1117846707":[{m:"Hb1-c3",e:9.167},{m:"Rh1-h7",e:9.167},{m:"Hb1-a3",e:9.167},{m:"c4-c5",e:9.167}],"-1#-284727296":[{m:"Ri10-i9",e:5}],"-1#129308976":[{m:"Hb10-c8",e:5}],"-1#-1568555243":[{m:"Hb10-c8",e:5}],"1#-1282298455":[{m:"Ra1-a2",e:5}],"-1#1917599685":[{m:"Hb10-c8",e:9}],"1#-714438622":[{m:"Eg1-e3",e:5}],"1#-1692988831":[{m:"Hh1-g3",e:9.583}],"-1#-727013463":[{m:"Hh10-g8",e:9.583}],"1#376593636":[{m:"g4-g5",e:9.583},{m:"Ri1-h1",e:9.583}],"-1#1522117129":[{m:"Ri10-h10",e:5}],"1#16308216":[{m:"Eg1-e3",e:5}],"-1#-2040409814":[{m:"Hb10-c8",e:5}],"1#-1754152042":[{m:"Hb1-a3",e:5}],"-1#-2001764402":[{m:"Rh10-h6",e:5}],"1#762889876":[{m:"Cb3-c3",e:5}],"-1#663807373":[{m:"Rh6-d6",e:5}],"1#-1935069442":[{m:"Cd3xd8",e:5}],"-1#632367693":[{m:"Cb8xd8",e:5}],"1#-542855793":[{m:"Af1-e2",e:5}],"-1#485427156":[{m:"Hb10-a8",e:9.565},{m:"Eg10-e8",e:9.565},{m:"g7-g6",e:9.565}],"1#1450723286":[{m:"Hb1-a3",e:5}],"-1#1235680142":[{m:"a7-a6",e:5}],"1#-541967573":[{m:"c4-c5",e:6.667}],"-1#278988707":[{m:"Hb10-a8",e:6.667}],"1#1773531305":[{m:"Rh1-h5",e:9.861},{m:"Hb1-c3",e:9.861}],"1#-965483602":[{m:"Hh1-g3",e:5}],"-1#-1982968218":[{m:"Ra10-a9",e:5}],"1#-1852319961":[{m:"Ri1-h1",e:5}],"-1#-1693807593":[{m:"Hh10-g8",e:5}],"1#1506965338":[{m:"g4-g5",e:5}],"-1#353993143":[{m:"Ri10-h10",e:5}],"1#1331231814":[{m:"c4-c5",e:5}],"-1#-2142519090":[{m:"Ra9-d9",e:5}],"1#-270803603":[{m:"Ad1-e2",e:5}],"-1#-1596797843":[{m:"Rd9-d6",e:5}],"1#1728543403":[{m:"Hb1-c3",e:5}],"-1#895422950":[{m:"g7-g6",e:5}],"1#1074128539":[{m:"Rh1-h7",e:5}],"-1#-84935450":[{m:"g6xg5",e:5}],"1#1613444305":[{m:"Rh7-g7",e:5}],"-1#1909048633":[{m:"Eg10-e8",e:5}],"1#-1298859578":[{m:"Rg7xg5",e:5}],"-1#-1014999057":[{m:"Ch8-h9",e:5}],"1#-1678559764":[{m:"Hc3-d5",e:5}],"-1#-1313813551":[{m:"Ch9-g9",e:5}],"1#-780288482":[{m:"Cd3xd6",e:5}],"-1#1926424655":[{m:"Cg9xg5",e:5}],"1#-1602837681":[{m:"Hh1-g3",e:9.6}],"-1#-271905145":[{m:"Ri10-i9",e:9.6},{m:"Hh10-g8",e:9.6}],"1#-1369318685":[{m:"Hb1-a3",e:9.836},{m:"Ad1-e2",e:9.836},{m:"Af1-e2",e:9.836},{m:"Eg1-e3",e:9.836},{m:"Ec1-e3",e:9.836},{m:"Ri1-h1",e:9.836}],"-1#-1312856389":[{m:"a7-a6",e:8}],"-1#-513225757":[{m:"Hh10-i8",e:5}],"-1#687397937":[{m:"Hh10-i8",e:5}],"1#756282826":[{m:"Ri1-h1",e:5}],"-1#663662330":[{m:"Ri10-h10",e:5}],"1#2110771979":[{m:"g4-g5",e:6.667},{m:"Ec1-e3",e:6.667}],"-1#822355430":[{m:"Ch8-h6",e:5}],"1#181231332":[{m:"Eg1-e3",e:5}],"-1#-1940629450":[{m:"Ch6-a6",e:5}],"1#-1769002707":[{m:"Cb3-a3",e:5}],"-1#-819380958":[{m:"g7-g6",e:5}],"1#-1166816673":[{m:"Rh1-h5",e:5}],"-1#716719351":[{m:"Ch8-i8",e:5}],"1#-2096534157":[{m:"Hh1-g3",e:5}],"-1#-860569413":[{m:"Ec10-e8",e:5}],"1#-534331304":[{m:"Ec1-e3",e:5}],"-1#1388326513":[{m:"Ri10-i9",e:5}],"1#325777941":[{m:"Ad1-e2",e:6.667},{m:"Hb1-c3",e:6.667}],"-1#1550052117":[{m:"a7-a6",e:5}],"1#1480717847":[{m:"Hb1-c3",e:5}],"-1#169450842":[{m:"c7-c6",e:5}],"1#-914463135":[{m:"Ri1-h1",e:5}],"-1#-1008517807":[{m:"i6-i5",e:5}],"1#89586060":[{m:"i4xi5",e:5}],"-1#1818219423":[{m:"Ri9xi5",e:5}],"1#697313427":[{m:"g4-g5",e:5}],"-1#1093833048":[{m:"c7-c6",e:5}],"1#-2108331421":[{m:"Ri1-h1",e:5}],"-1#-2000146093":[{m:"Hh10-i8",e:5}],"1#11732655":[{m:"Rh1-h5",e:5}],"-1#-1871149049":[{m:"Ch8-f8",e:5}],"1#1398919726":[{m:"Cb3-a3",e:5}],"-1#1627380546":[{m:"Hb10-c8",e:5}],"1#1911540222":[{m:"Ra1-b1",e:5}],"1#1334007959":[{m:"Cb3-c3",e:9.5},{m:"Hh1-g3",e:9.5}],"-1#1164671886":[{m:"Ec10-e8",e:5}],"1#1777957741":[{m:"Hb1-a3",e:5}],"-1#1982318389":[{m:"Hb10-c8",e:5}],"1#1731712393":[{m:"Ra1-b1",e:5}],"-1#1369122165":[{m:"Ra10-b10",e:5}],"1#1776880620":[{m:"Hh1-g3",e:5}],"-1#643081764":[{m:"Ch8-f8",e:5}],"1#-447874035":[{m:"Ri1-h1",e:5}],"-1#-271538371":[{m:"Hh10-g8",e:5}],"1#755522672":[{m:"c4-c5",e:5}],"-1#4126047":[{m:"Hb10-c8",e:9.474},{m:"Hh10-i8",e:9.474},{m:"Hh10-g8",e:9.474},{m:"Ch8-d8",e:9.474},{m:"Ec10-e8",e:9.474},{m:"c7-c6",e:8.75},{m:"c7-c6",e:9.974}],"1#288286691":[{m:"Ri1-h1",e:5}],"1#399334546":[{m:"Ri1-h1",e:5}],"1#749532604":[{m:"Ri1-h1",e:5}],"1#-121728027":[{m:"Ec1-e3",e:6.667},{m:"Hb1-a3",e:6.667}],"-1#1247313356":[{m:"Ri10-i8",e:5}],"1#287138655":[{m:"Ri1-h1",e:5}],"-1#461387887":[{m:"Ri8-d8",e:5}],"1#845989603":[{m:"Ad1-e2",e:5}],"-1#2103826403":[{m:"Hh10-g8",e:5}],"1#-1078121298":[{m:"Rh1-h5",e:5}],"-1#796303878":[{m:"Cc8-c9",e:5}],"1#1066231450":[{m:"Hb1-a3",e:5}],"-1#542366402":[{m:"a7-a6",e:5}],"-1#-413126723":[{m:"Ri10-i8",e:5}],"1#-1138413266":[{m:"Ri1-h1",e:5}],"-1#-1229428194":[{m:"Ri8-d8",e:5}],"1#-1621846894":[{m:"Ad1-e2",e:5}],"-1#-799177326":[{m:"Hh10-g8",e:5}],"1#310738655":[{m:"Rh1-h5",e:5}],"-1#-2108755849":[{m:"Hb10-a8",e:5}],"1#-925257611":[{m:"Ec1-e3",e:5}],"-1#2050973276":[{m:"Ec10-e8",e:5}],"1#1666679908":[{m:"Ri1-h1",e:6.667}],"-1#1774903124":[{m:"Hh10-g8",e:6.667}],"1#-1424874471":[{m:"Cb3-c3",e:7.5},{m:"Ad1-e2",e:7.5},{m:"g4-g5",e:7.5}],"1#1342044549":[{m:"Hh1-g3",e:7.5}],"-1#4215885":[{m:"Cb8-e8",e:7.5},{m:"g7-g6",e:7.5},{m:"Hh10-g8",e:7.5}],"1#904422373":[{m:"Ri1-h1",e:6.667},{m:"Eg1-e3",e:6.667}],"-1#1064646869":[{m:"Hh10-g8",e:5}],"-1#-1284414153":[{m:"Hb10-c8",e:5}],"1#-1570670709":[{m:"c4-c5",e:5}],"1#-1030181120":[{m:"Ri1-h1",e:5}],"-1#-939133904":[{m:"g7-g6",e:5}],"1#-275918185":[{m:"Hh1-g3",e:9.974}],"-1#-1607434401":[{m:"Hb10-c8",e:9.974},{m:"Hh10-g8",e:9.974},{m:"c7-c6",e:9.974},{m:"Ch8-e8",e:9.918}],"1#-1323274781":[{m:"Ri1-h1",e:7.5},{m:"c4-c5",e:7.5}],"-1#-1145227565":[{m:"Hh10-g8",e:6.667}],"-1#2117292395":[{m:"Cb8xb1",e:5}],"1#1659405330":[{m:"Hb1-c3",e:9.972},{m:"g4-g5",e:9.972},{m:"Ri1-h1",e:9.972},{m:"Eg1-e3",e:9.972},{m:"Af1-e2",e:9.972}],"1#-509957317":[{m:"Ri1-h1",e:9.744},{m:"Hb1-c3",e:9.744},{m:"Af1-e2",e:9.744},{m:"c4-c5",e:9.744}],"1#1312577761":[{m:"Hh1-g3",e:9.988},{m:"g4-g5",e:9.988},{m:"c4-c5",e:9.988}],"-1#25294121":[{m:"Hh10-g8",e:9.167},{m:"Ch8-i8",e:9.986},{m:"Ri10-h10",e:9.986},{m:"Ri10-i9",e:9.986},{m:"g7-g6",e:9.986},{m:"Hh10-g8",e:9.474}],"1#277997461":[{m:"Hh1-g3",e:5}],"-1#-545072355":[{m:"g7-g6",e:6.667},{m:"Ch8-i8",e:6.667}],"1#-1428673440":[{m:"Hb1-c3",e:5}],"-1#-125810899":[{m:"Ra10-a9",e:7.5},{m:"Ri10-h10",e:7.5}],"1#-496780818":[{m:"Ri1-h1",e:5}],"-1#-385948962":[{m:"Ec10-e8",e:5}],"1#-999497155":[{m:"g4-g5",e:5}],"-1#-2002316080":[{m:"Ad10-e9",e:5}],"1#1012963290":[{m:"c4-c5",e:5}],"-1#49786380":[{m:"Ri10-i9",e:9.898},{m:"c7-c6",e:9.898},{m:"Ri10-h10",e:9.898},{m:"Hb10-a8",e:9.898}],"1#-1047505609":[{m:"Hh1-g3",e:9.167}],"1#1488376829":[{m:"Hb1-a3",e:9.882}],"1#1214311950":[{m:"Hh1-g3",e:5}],"1#-509528225":[{m:"Hh1-g3",e:7.5}],"-1#-1373857129":[{m:"Hb10-c8",e:7.5},{m:"Hh10-g8",e:7.5}],"1#-1089697749":[{m:"Hb1-a3",e:5}],"-1#-1596836749":[{m:"Ra10-b10",e:5}],"1#-1734337814":[{m:"Ra1-b1",e:5}],"-1#-1374885354":[{m:"Rb10-b4",e:5}],"1#1395332087":[{m:"Ri1-h1",e:5}],"-1#1505118407":[{m:"Hh10-g8",e:5}],"1#-1687243894":[{m:"Cb3-c3",e:5}],"-1#-1853452141":[{m:"Rb4xb1",e:5}],"1#-1118820910":[{m:"Ha3xb1",e:5}],"-1#1762503016":[{m:"Ri10-h10",e:5}],"1#1824809434":[{m:"Hb1-a3",e:6.667},{m:"c4-c5",e:6.667}],"-1#1931140482":[{m:"Hb10-a8",e:5}],"1#965582208":[{m:"Ra1-b1",e:5}],"-1#253848956":[{m:"Ri10-h10",e:5}],"1#1432359053":[{m:"Ri1-h1",e:5}],"-1#-1546166958":[{m:"Ri10-h10",e:5}],"1#-107601757":[{m:"Hb1-c3",e:5}],"-1#-1412543506":[{m:"Ch8-i8",e:5}],"1#-1775294179":[{m:"Ra1-b1",e:8.333}],"1#1952761110":[{m:"Hh1-g3",e:8.75}],"-1#1004103902":[{m:"c7-c6",e:8.75},{m:"Ch8-c8",e:7.5}],"1#1620866637":[{m:"Ri1-h1",e:9},{m:"Af1-e2",e:9},{m:"Hb1-a3",e:9}],"-1#1778462077":[{m:"Ri8-h8",e:8},{m:"Ri8-d8",e:8}],"1#-1570225155":[{m:"Rh1xh8",e:5}],"-1#-1134921059":[{m:"Cb8xh8",e:5}],"1#1139659761":[{m:"Af1-e2",e:7.5},{m:"Ad1-e2",e:7.5}],"-1#952474759":[{m:"Ri8-d8",e:6.667}],"1#287924747":[{m:"Eg1-e3",e:6.667}],"-1#-1750047527":[{m:"Hh10-g8",e:6.667},{m:"g7-g6",e:6.667}],"1#1432919956":[{m:"Ri1-f1",e:5}],"1#-487943260":[{m:"Ri1-f1",e:5}],"-1#2135083541":[{m:"Ri8-d8",e:7.5}],"1#1454257305":[{m:"Af1-e2",e:7.5}],"-1#251125331":[{m:"a7-a6",e:7.5},{m:"Hb10-a8",e:7.5},{m:"g7-g6",e:7.5}],"1#1147182673":[{m:"a4-a5",e:5}],"1#-1644908272":[{m:"c4-c5",e:9.231},{m:"Hh1-g3",e:9.231}],"-1#1390906776":[{m:"Hh10-g8",e:5}],"1#-1874889003":[{m:"Hh1-g3",e:5}],"-1#-766960424":[{m:"Ri10-i9",e:9.167},{m:"Hh10-g8",e:9.167},{m:"Cb8-a8",e:9.167},{m:"Hh10-i8",e:9.167},{m:"Hb10-c8",e:9.974}],"1#-1813788484":[{m:"Ri1-h1",e:7.5}],"1#457912088":[{m:"Hb1-a3",e:5}],"-1#76911424":[{m:"Ra10-b10",e:5}],"1#1513237284":[{m:"c4-c5",e:8.333},{m:"Ri1-h1",e:8.333}],"1#-1186163708":[{m:"Hh1-g3",e:8.571}],"-1#-151963188":[{m:"Hh10-i8",e:8.571},{m:"Cb8-e8",e:7.5},{m:"Ch8-h4",e:8.571},{m:"Ri10-i9",e:8.571},{m:"Hb10-c8",e:8.571}],"1#2122976816":[{m:"Hb1-a3",e:5}],"-1#1632940648":[{m:"Hb10-c8",e:5}],"1#1883545812":[{m:"Ra1-b1",e:5}],"-1#1189629992":[{m:"Ri10-h10",e:5}],"1#-747109722":[{m:"g4-g5",e:5}],"-1#-1615596469":[{m:"Hh10-i8",e:5}],"1#399033271":[{m:"Hb1-a3",e:5}],"-1#135692271":[{m:"Hb10-c8",e:5}],"1#-1218712152":[{m:"Ri1-h1",e:5}],"-1#-1111050600":[{m:"Ri9-d9",e:5}],"1#1120018215":[{m:"Hb1-c3",e:5}],"-1#278557802":[{m:"Hh10-g8",e:5}],"1#-767389913":[{m:"Rh1-h5",e:5}],"1#-404673680":[{m:"Hb1-c3",e:6.667},{m:"Ri1-h1",e:6.667}],"-1#-1246150595":[{m:"Hh10-g8",e:5}],"-1#-310611904":[{m:"Ch8-f8",e:5}],"1#1337565011":[{m:"Hh1-g3",e:6.667}],"-1#275099":[{m:"Hh10-g8",e:6.667},{m:"Ch8-f8",e:6.667}],"1#-1025717802":[{m:"Ri1-h1",e:5}],"-1#-935226650":[{m:"Ri10-h10",e:5}],"1#-1845432553":[{m:"c4-c5",e:5}],"-1#1561580447":[{m:"Hb10-a8",e:5}],"1#394564509":[{m:"Hb1-c3",e:5}],"-1#1172109520":[{m:"Ra10-a9",e:5}],"1#1569022353":[{m:"Ec1-e3",e:5}],"-1#-278687816":[{m:"Ra9-d9",e:5}],"1#-2131520997":[{m:"Rh1-h5",e:5}],"-1#272112819":[{m:"Rd9-d4",e:5}],"1#-1021482830":[{m:"Ri1-h1",e:5}],"-1#-914345086":[{m:"Hh10-g8",e:5}],"1#190367951":[{m:"c4-c5",e:5}],"-1#-1001655225":[{m:"g7-g6",e:5}],"1#-1324285126":[{m:"Hb1-c3",e:5}],"-1#-481728393":[{m:"Cb8-c8",e:5}],"1#1874272789":[{m:"Ec1-e3",e:5}],"-1#-581841860":[{m:"Hb10-a8",e:5}],"1#-1748595650":[{m:"Hc3-b5",e:5}],"-1#-555457966":[{m:"Hg8-f6",e:5}],"1#77567056":[{m:"Hh1-g3",e:9.231},{m:"i4-i5",e:9.231}],"-1#1260534168":[{m:"Ec10-e8",e:9.167},{m:"Ri10-h10",e:9.167},{m:"Ri10-i9",e:9.167},{m:"Ch8-g8",e:9.167}],"1#1739602299":[{m:"Ri1-h1",e:5}],"-1#1831690827":[{m:"Ri10-i9",e:5}],"1#291718249":[{m:"c4-c5",e:8.889},{m:"Eg1-e3",e:8.889}],"1#176745980":[{m:"Ri1-h1",e:7.5}],"1#1037637458":[{m:"c4-c5",e:5}],"-1#-221631526":[{m:"Ri10-h10",e:5}],"-1#-1165980624":[{m:"Ec10-e8",e:5}],"1#-1777169197":[{m:"Hh1-g3",e:5}],"-1#-642834149":[{m:"Ri10-i9",e:5}],"1#-1744439937":[{m:"Ri1-h1",e:5}],"-1#-1835487665":[{m:"Ri9-d9",e:5}],"1#1838942192":[{m:"Af1-e2",e:5}],"-1#902163770":[{m:"Rd9-d5",e:5}],"1#1158338083":[{m:"Hb1-c3",e:5}],"-1#391298414":[{m:"Ch8-f8",e:5}],"1#-733223097":[{m:"Eg1-e3",e:5}],"-1#1389552021":[{m:"Rd5-d4",e:5}],"1#-98595482":[{m:"c4-c5",e:8.75},{m:"Eg1-e3",e:8.75},{m:"Hh1-g3",e:8.75}],"-1#890024430":[{m:"Hh10-i8",e:8},{m:"Ri10-i9",e:8},{m:"Cb8-b4",e:8}],"1#-1116240366":[{m:"Hb1-c3",e:5}],"1#1957062026":[{m:"Hb1-c3",e:5}],"1#-2000553750":[{m:"Hb1-c3",e:6.667}],"-1#2089192372":[{m:"Hh10-i8",e:5}],"1#-184697784":[{m:"Hh1-g3",e:5}],"-1#-1153429120":[{m:"Cg8xg4",e:5}],"1#1265342096":[{m:"c4-c5",e:5}],"-1#-2072466920":[{m:"Cb8-b4",e:5}],"1#968221468":[{m:"Hb1-c3",e:5}],"-1#1810729041":[{m:"Cb4-c4",e:5}],"-1#-1247666002":[{m:"Cg8xg4",e:6.667}],"1#1166649278":[{m:"Eg1-e3",e:6.667},{m:"Ri1-h1",e:6.667}],"-1#-1022320276":[{m:"Hh10-g8",e:5}],"1#29907489":[{m:"Ri1-h1",e:5}],"-1#1326775438":[{m:"Hh10-g8",e:5}],"1#-1916008509":[{m:"Ec1-e3",e:5}],"1#-850495544":[{m:"Hb1-c3",e:9.919},{m:"Hh1-g3",e:9.919}],"-1#-1625940859":[{m:"Hb10-c8",e:5}],"1#-1912205767":[{m:"Hh1-g3",e:5}],"-1#-1044667407":[{m:"Ri9-d9",e:5}],"1#1052707406":[{m:"Ri1-h1",e:8}],"-1#874664318":[{m:"Hh10-i8",e:8.333}],"1#-1134991742":[{m:"Rh1-h5",e:8.571},{m:"c4-c5",e:8.571}],"-1#747825194":[{m:"Rd9-d4",e:6.667}],"-1#1934252554":[{m:"Rd9-d4",e:8.571},{m:"i7-i6",e:8.571}],"-1#-2097948160":[{m:"Ri10-i9",e:9.167},{m:"Ch8-e8",e:9.918},{m:"Ri10-i9",e:9.6},{m:"Ri9-d9",e:9.918},{m:"Ri10-i9",e:9.167},{m:"Eg10-e8",e:9.918}],"1#2113369023":[{m:"Ad1-e2",e:9.865}],"1#1101981439":[{m:"Ri1-h1",e:5}],"-1#1261682127":[{m:"Ri9-d9",e:5}],"1#-677266113":[{m:"Hh1-g3",e:7.5}],"-1#-1742991113":[{m:"Ch8-c8",e:7.5}],"-1#1429290896":[{m:"Ch8-e8",e:10},{m:"Hh10-g8",e:10},{m:"Hb10-c8",e:10},{m:"Cb8-e8",e:10},{m:"Ec10-e8",e:10},{m:"Eg10-e8",e:10},{m:"Cb8-f8",e:10},{m:"Ad10-e9",e:10},{m:"Cb8-b7",e:10},{m:"Ch8-h7",e:10},{m:"Af10-e9",e:10}],"1#911756971":[{m:"Hb1-c3",e:9.997},{m:"Ri1-i2",e:9.997},{m:"c4-c5",e:9.997},{m:"Ce3xe7+",e:9.997},{m:"g4-g5",e:9.997},{m:"Hh1-g3",e:9.997}],"-1#1662780099":[{m:"Ce8xe4+",e:9.972},{m:"Hh10-g8",e:9.972},{m:"Cb8-d8",e:9.972}],"1#-1545710550":[{m:"Ad1-e2",e:9.5}],"1#-1580926578":[{m:"Hh1-g3",e:9.97},{m:"Ri2-d2",e:9.97}],"1#240752176":[{m:"Hh1-g3",e:5}],"-1#1923821097":[{m:"Ad10-e9",e:8.333},{m:"Af10-e9",e:8.333}],"1#-1637214504":[{m:"Cb3-e3",e:8},{m:"Hh1-g3",e:8}],"1#2113989307":[{m:"Cb3-e3",e:5}],"-1#-733971167":[{m:"Hh10-g8",e:5}],"1#379094636":[{m:"Hh1-g3",e:5}],"-1#2056501318":[{m:"Hh10-g8",e:6.667}],"1#-1203027189":[{m:"Hh1-g3",e:6.667}],"-1#-134811965":[{m:"Ri10-i9",e:9.922},{m:"Hb10-c8",e:9.922},{m:"Ri10-h10",e:9.922},{m:"c7-c6",e:9.922}],"1#-1380478158":[{m:"Hb1-a3",e:9.873}],"-1#2045109091":[{m:"g7-g6",e:9.996},{m:"Hh10-g8",e:9.996},{m:"Hb10-a8",e:9.996},{m:"Ri10-i9",e:9.996}],"1#-1153624018":[{m:"Hh1-g3",e:8}],"-1#-2115151915":[{m:"Hb10-c8",e:8.333},{m:"Ri10-h10",e:8.333}],"1#-1862449815":[{m:"Ri1-h1",e:8},{m:"Hb1-c3",e:8}],"-1#-1704976807":[{m:"Ad10-e9",e:8},{m:"Ri10-i9",e:8},{m:"Cb8-a8",e:8}],"1#1398943129":[{m:"c4-c5",e:5}],"-1#-1029362140":[{m:"Ra10-b10",e:6.667}],"1#-86572867":[{m:"Ri1-h1",e:6.667},{m:"Ra1-b1",e:6.667}],"1#-609474012":[{m:"Hb1-c3",e:6.667}],"-1#-1980481175":[{m:"Hb10-a8",e:6.667}],"1#-1016921749":[{m:"Ra1-b1",e:6.667}],"-1#-170921577":[{m:"Ra10-b10",e:6.667}],"1#-843194610":[{m:"g4-g5",e:6.667},{m:"c4-c5",e:6.667}],"-1#-2122962461":[{m:"c7-c6",e:5}],"-1#45015942":[{m:"Rh10-h5",e:5}],"1#944715527":[{m:"Hb1-a3",e:9.976}],"1#-1746287395":[{m:"Hb1-c3",e:9.999},{m:"Ri1-i2",e:9.999},{m:"c4-c5",e:9.999},{m:"Hh1-g3",e:9.999},{m:"Ch3-e3",e:8.333},{m:"Ri1-i3",e:9.999},{m:"Cb3-d3",e:9.999}],"-1#-1028814667":[{m:"Ri10-h10",e:8.571},{m:"g7-g6",e:8.571},{m:"Hb10-c8",e:8.571}],"1#-1729301180":[{m:"Hb1-c3",e:7.5}],"1#-1208516664":[{m:"c4-c5",e:5}],"1#-742548983":[{m:"Hh1-g3",e:6.667}],"-1#-665556715":[{m:"Ch8-h9",e:9.999},{m:"Ch8-h4",e:9.999},{m:"Af10-e9",e:9.999},{m:"Hh10-g8",e:9.677},{m:"Ri10-i9",e:9.999},{m:"c7-c6",e:9.999}],"1#-188323338":[{m:"Ri1-h1",e:8.75}],"-1#842413793":[{m:"Ri10-h10",e:5}],"1#1752648464":[{m:"Ri3-f3",e:5}],"-1#1244273735":[{m:"Hb10-c8",e:5}],"1#1530531579":[{m:"Hh1-g3",e:5}],"-1#344433459":[{m:"Ec10-e8",e:5}],"1#940942288":[{m:"Hb1-c3",e:5}],"-1#-1388737754":[{m:"Hb10-c8",e:6.667},{m:"c7-c6",e:6.667}],"1#-1138124390":[{m:"Hb1-c3",e:5}],"1#1851682845":[{m:"Hh1-g3",e:5}],"-1#568581589":[{m:"Ri10-h10",e:5}],"1#1143024940":[{m:"Hb1-a3",e:9.998},{m:"g4-g5",e:9.998},{m:"c4-c5",e:9.998},{m:"Hb1-c3",e:9.998},{m:"Hh1-g3",e:9.998},{m:"Ri1-i2",e:9.998},{m:"Cb3-c3",e:9.998}],"-1#-1959652956":[{m:"g7-g6",e:9.969},{m:"Cb8-a8",e:9.969},{m:"Hb10-c8",e:9.286},{m:"Ec10-e8",e:9.969},{m:"Hh10-g8",e:9.969},{m:"Hb10-c8",e:5}],"-1#377046625":[{m:"Hb10-c8",e:9.286},{m:"Hh10-g8",e:8.333},{m:"Ch8-f8",e:8.333},{m:"Ri10-i9",e:8.333},{m:"Cb8-a8",e:8.333}],"-1#194805988":[{m:"Ch8-e8",e:9.997},{m:"g7-g6",e:9.997},{m:"Ri10-i9",e:9.997},{m:"Ch8-g8",e:9.997},{m:"Cb8-b6",e:9.997},{m:"Cb8-a8",e:9.997}],"-1#291856708":[{m:"Hh10-i8",e:7.5},{m:"Ri10-i9",e:7.5},{m:"Cb8-a8",e:7.5}],"1#-1726064968":[{m:"Hh1-g3",e:5}],"1#1355789600":[{m:"Ri2-d2",e:5}],"1#-664317308":[{m:"Cb3-b7",e:5}],"-1#1321799221":[{m:"Hh10-i8",e:5}],"1#-961398327":[{m:"i4-i5",e:5}],"-1#2024612265":[{m:"Ri10-i9",e:5}],"1#956822989":[{m:"Hh1-g3",e:5}],"-1#1991923717":[{m:"Ch8-g8",e:5}],"1#4290255":[{m:"c4-c5",e:5}],"1#1620641848":[{m:"Hh1-g3",e:9.942},{m:"Hb1-c3",e:9.942}],"-1#790930928":[{m:"Ch8-g8",e:9.939},{m:"Hh10-g8",e:9.939},{m:"Hb10-c8",e:9.939},{m:"Ch8-f8",e:9.939},{m:"Hh10-i8",e:9.939}],"1#1507822394":[{m:"Ri1-h1",e:7.5}],"-1#1396887562":[{m:"Hh10-i8",e:7.5}],"1#-616962058":[{m:"Hb1-c3",e:7.5}],"1#-302227779":[{m:"Hb1-c3",e:9.839},{m:"Hh1-g3",e:5},{m:"Ri1-h1",e:9.839}],"1#1043642188":[{m:"Cb3-d3",e:9.886},{m:"Hb1-c3",e:9.886},{m:"Hh1-g3",e:5}],"1#-331481127":[{m:"Ri1-h1",e:8.75},{m:"Ce3xe7+",e:8.75},{m:"Hb1-a3",e:8.75}],"1#-1486908916":[{m:"Hb1-c3",e:9.688},{m:"Hb1-a3",e:9.688}],"-1#851534709":[{m:"Hb10-c8",e:8.889},{m:"c7-c6",e:8.889}],"1#600928713":[{m:"Ra1-b1",e:8.75}],"-1#360546613":[{m:"Hh10-g8",e:8.75},{m:"Hh10-i8",e:8.75},{m:"Ch8-f8",e:8.75}],"1#-677021064":[{m:"Hh1-g3",e:8}],"-1#-1743202384":[{m:"Ra10-a9",e:9.167}],"1#-1660504375":[{m:"Hh1-g3",e:5}],"-1#-759489791":[{m:"c7-c6",e:8.333}],"1#-698033380":[{m:"Ri1-i3",e:6.667}],"1#-240740274":[{m:"Hh1-g3",e:5}],"-1#-1105513082":[{m:"Ch8-f8",e:5}],"1#2097311663":[{m:"Ri1-h1",e:5}],"-1#2006922399":[{m:"Hh10-g8",e:5}],"1#-1253584942":[{m:"Cb3-b7",e:5}],"-1#-1446295768":[{m:"g7-g6",e:5}],"1#-594431915":[{m:"Rh1-h7",e:5}],"-1#1719380520":[{m:"Hg8-f6",e:5}],"1#2040741747":[{m:"c4-c5",e:9.697},{m:"Hh1-g3",e:9.697}],"-1#907973307":[{m:"Hh10-g8",e:9.677},{m:"Hb10-d9",e:9.677},{m:"Ri10-i9",e:9.677},{m:"Ch8-g8",e:9.677},{m:"i7-i6",e:9.677},{m:"Hb10-c8",e:9.677},{m:"g7-g6",e:9.677},{m:"Hh10-i8",e:9.677}],"1#1010625953":[{m:"Hb1-c3",e:6.667}],"1#2008303327":[{m:"Ri1-h1",e:9.375},{m:"Ce3xe7+",e:9.375}],"1#1088797809":[{m:"Ri1-h1",e:5}],"1#972250212":[{m:"g4-g5",e:7.5}],"1#655261703":[{m:"c4-c5",e:9},{m:"Hb1-c3",e:9}],"1#1128555974":[{m:"Ri1-h1",e:5}],"-1#1238974198":[{m:"Hb10-d9",e:5}],"1#-1100634809":[{m:"Ri1-h1",e:6.667}],"-1#-1258750345":[{m:"Ri10-h10",e:6.667}],"1#-1771306129":[{m:"Hh1-g3",e:9.091},{m:"Ce3xe7+",e:9.091}],"-1#-640569689":[{
m:"g7-g6",e:8.889},{m:"Ch8-f8",e:8.889},{m:"Ri10-i9",e:8.889},{m:"Hh10-f9",e:8.889},{m:"Hh10-g8",e:8.889}],"1#-1400153638":[{m:"Ri1-h1",e:5}],"-1#-1508506902":[{m:"Hh10-f9",e:5}],"1#1366781929":[{m:"Hb1-a3",e:6.667}],"1#449377422":[{m:"Ri1-h1",e:5}],"-1#274051006":[{m:"Hh10-g8",e:5}],"1#-762489613":[{m:"Hb1-a3",e:5}],"1#-1736738109":[{m:"Ri1-h1",e:5}],"-1#-1830411789":[{m:"Ri9-d9",e:5}],"1#783336356":[{m:"Ri1-i2",e:7.5},{m:"Ri1-h1",e:7.5}],"-1#606967956":[{m:"Ri10-h10",e:6.667}],"1#453596650":[{m:"Ri1-h1",e:7.5}],"-1#294915802":[{m:"Ch8-i8",e:7.5},{m:"Ri10-h10",e:7.5}],"-1#-761306131":[{m:"Af10-e9",e:6.667}],"1#-566974593":[{m:"Cb3-i3",e:6.667},{m:"Cb3-e3",e:6.667}],"-1#1326715600":[{m:"Hh10-g8",e:5}],"1#-1915950691":[{m:"Ce7xi7",e:5}],"-1#1434486542":[{m:"Ri10-h10",e:5}],"1#264370943":[{m:"Ci7-i10+",e:5}],"-1#617790288":[{m:"Ee8-g10",e:5}],"1#-410024017":[{m:"Hh1-g3",e:5}],"-1#-1473107353":[{m:"Ch8-i8",e:5}],"1#-1781315436":[{m:"Ci10xg10",e:5}],"-1#1953771749":[{m:"Hh10-g8",e:5}],"1#-1230189656":[{m:"Ce7-e6",e:5}],"-1#752988806":[{m:"Hb10-c8",e:5}],"1#1039245370":[{m:"Hh1-g3",e:5}],"-1#1917586930":[{m:"Ri10-h10",e:5}],"1#671969283":[{m:"Hb1-c3",e:5}],"-1#2052397902":[{m:"Ra10-b10",e:5}],"1#1109865943":[{m:"Ra1-b1",e:5}],"1#1740617824":[{m:"Ce3-h3",e:5}],"-1#1026044292":[{m:"Cf8-b8",e:5}],"1#-1175451807":[{m:"Hh1-g3",e:7.5}],"-1#-162682199":[{m:"Ch8-d8",e:7.5}],"1#-507640988":[{m:"Ce3xe7+",e:7.5},{m:"Ri1-h1",e:7.5}],"-1#-1521654810":[{m:"Ec10-e8",e:5}],"1#-1981848827":[{m:"Ri1-i2",e:5}],"-1#-593809555":[{m:"Hh10-g8",e:5}],"1#507761696":[{m:"Ce7-e6",e:5}],"-1#-2079412978":[{m:"Hb10-a8",e:5}],"1#-828773108":[{m:"Ri2-d2",e:5}],"-1#1622426095":[{m:"Ra10-d10",e:5}],"1#-1499840379":[{m:"Cb3-e3",e:5}],"-1#215668511":[{m:"Cb8-b3",e:5}],"1#570488791":[{m:"Hb1-c3",e:5}],"-1#1884855450":[{m:"Cb3xe3",e:5}],"1#370766183":[{m:"Ce6xe3",e:5}],"-1#799383163":[{m:"Cd8-d3",e:5}],"1#917703683":[{m:"Hg3-i2",e:5}],"-1#202436748":[{m:"Ri10-h10",e:5}],"1#1448185213":[{m:"Ra1-b1",e:5}],"-1#1627225473":[{m:"Rd10-d8",e:5}],"1#-689345457":[{m:"e4-e5",e:5}],"-1#-350005164":[{m:"Hh10-g8",e:6.667}],"1#704357145":[{m:"c4-c5",e:6.667},{m:"g4-g5",e:6.667}],"-1#-420962415":[{m:"Hb10-a8",e:5}],"1#-1400905837":[{m:"Hb1-c3",e:5}],"-1#-30952226":[{m:"Ec10-e8",e:5}],"1#-759843779":[{m:"Hc3-d5",e:5}],"-1#-118076928":[{m:"Ri10-i9",e:5}],"1#-1185112476":[{m:"Hd5xe7",e:5}],"-1#1856517231":[{m:"Hg8xe7",e:5}],"1#292712683":[{m:"Ce3xe7",e:5}],"-1#1697666548":[{m:"Ri10-i9",e:5}],"1#614105488":[{m:"Hb1-c3",e:5}],"-1#1992485597":[{m:"Ri9-f9",e:5}],"1#1652898623":[{m:"c4-c5",e:5}],"-1#-1382676553":[{m:"Rf9-f6",e:5}],"1#419948311":[{m:"Cb3-a3",e:5}],"-1#714731131":[{m:"Ec10-e8",e:5}],"1#-2069786886":[{m:"Hh1-g3",e:9.091}],"-1#-887348430":[{m:"Ch8-d8",e:9.091},{m:"Ch8-c8",e:9.091}],"1#-588281089":[{m:"c4-c5",e:7.5},{m:"Ri1-h1",e:7.5},{m:"Cb3-d3",e:7.5}],"-1#335328887":[{m:"Hh10-g8",e:5}],"1#-786150086":[{m:"Ri1-h1",e:5}],"-1#-608627190":[{m:"Eg10-e8",e:5}],"1#417606389":[{m:"Hb1-c3",e:5}],"-1#1253851576":[{m:"Hb10-a8",e:5}],"1#2818490":[{m:"a4-a5",e:5}],"-1#-697118257":[{m:"Hh10-g8",e:5}],"1#346696322":[{m:"Hb1-c3",e:5}],"-1#1190281679":[{m:"c7-c6",e:5}],"1#-2053784844":[{m:"Rh1-h5",e:5}],"-1#358495324":[{m:"Cb7-c7",e:5}],"-1#-432028412":[{m:"Hh10-g8",e:5}],"1#619134537":[{m:"Hb1-c3",e:5}],"-1#1992250628":[{m:"Hb10-a8",e:5}],"1#1009259782":[{m:"Ra1-b1",e:5}],"-1#176481786":[{m:"Ha8-c9",e:5}],"1#865879432":[{m:"Hb1-a3",e:8.75},{m:"g4-g5",e:8.75},{m:"Ri1-h1",e:8.75},{m:"Ri1-i2",e:8.75}],"-1#742586832":[{m:"Hb10-a8",e:6.667},{m:"Hh10-g8",e:6.667}],"1#1725282770":[{m:"Ri1-h1",e:5}],"1#-291896675":[{m:"Cb3-c3",e:5}],"-1#2136453989":[{m:"Ri10-i9",e:5}],"1#1056794369":[{m:"Ri1-h1",e:5}],"-1#878722097":[{m:"Hh10-g8",e:5}],"-1#956374712":[{m:"Hh10-g8",e:7.5}],"1#-69605899":[{m:"g4-g5",e:7.5},{m:"Hb1-a3",e:7.5}],"-1#-1223552232":[{m:"Hh10-g8",e:5}],"-1#1725434336":[{m:"Hh10-g8",e:5}],"1#-1543441747":[{m:"Ri2-d2",e:5}],"-1#170745422":[{m:"Ec10-e8",e:5}],"1#310571111":[{m:"Hb1-c3",e:8},{m:"Cb3-b7",e:8},{m:"Hh1-g3",e:8}],"-1#1088068394":[{m:"c7-c6",e:5}],"1#-2084741103":[{m:"Hh1-g3",e:5}],"-1#-872362535":[{m:"Hh10-g8",e:5}],"1#249050772":[{m:"Ri1-h1",e:5}],"-1#71658916":[{m:"Ri10-h10",e:5}],"1#1577324629":[{m:"Rh1-h5",e:5}],"-1#-825254147":[{m:"Ec10-e8",e:5}],"1#-497181154":[{m:"Cb3-b7",e:5}],"-1#-19851548":[{m:"Ch7-h6",e:5}],"1#-1619618464":[{m:"Cb7xg7",e:5}],"-1#1540122396":[{m:"Hb10-c8",e:5}],"1#1255962016":[{m:"g4-g5",e:5}],"-1#235829405":[{m:"c7-c6",e:5}],"1#-848723034":[{m:"g4-g5",e:5}],"-1#-2120059573":[{m:"Ec10-e8",e:5}],"1#-1389333080":[{m:"Hh1-g3",e:5}],"-1#-494020512":[{m:"Hh10-i8",e:5}],"1#1794568092":[{m:"Ri1-h1",e:5}],"-1#1617671340":[{m:"Ri10-h10",e:5}],"1#975882589":[{m:"Rh1xh7",e:5}],"-1#-479170248":[{m:"Rh10xh7",e:5}],"1#285418497":[{m:"Ce3xe7+",e:5}],"-1#1441809539":[{m:"Ad10-e9",e:5}],"1#-1187939214":[{m:"Ce7xh7",e:5}],"-1#1564433839":[{m:"Cb8-h8",e:6.667}],"1#-83965315":[{m:"Cb3-d3",e:6.667},{m:"Hb1-c3",e:6.667}],"-1#-1070692986":[{m:"Hb10-c8",e:5}],"1#-784427206":[{m:"Hb1-c3",e:5}],"-1#-2090402697":[{m:"Ra10-b10",e:5}],"1#-1156263186":[{m:"Ra1-a2",e:5}],"-1#844454469":[{m:"Rb10-b4",e:5}],"-1#-1465474768":[{m:"Hb10-c8",e:5}],"1#-1179208820":[{m:"Ra1-b1",e:5}],"-1#-1894104208":[{m:"Ra10-a9",e:5}],"1#-1757160911":[{m:"c4-c5",e:5}],"-1#1481696953":[{m:"Ra9-d9",e:5}],"1#1503329026":[{m:"Hh1-g3",e:9.333}],"-1#371676874":[{m:"Ch8-d8",e:9.333},{m:"Hb10-c8",e:9.333},{m:"Cb8-f8",e:9.333}],"1#30736135":[{m:"Ri1-h1",e:9.231},{m:"Ce3xe7+",e:9.231},{m:"c4-c5",e:9.231},{m:"Hb1-c3",e:9.231}],"-1#189375543":[{m:"Hh10-g8",e:8.571}],"1#-913219718":[{m:"Hb1-a3",e:8.571}],"-1#1160224645":[{m:"Eg10-e8",e:6.667}],"1#-2038783110":[{m:"Ri1-h1",e:6.667}],"-1#-825769073":[{m:"Hh10-g8",e:6.667}],"1#203372738":[{m:"Ri1-h1",e:6.667}],"-1#1401721930":[{m:"Hh10-g8",e:6.667}],"1#-1856737529":[{m:"Ri1-h1",e:6.667}],"1#121062518":[{m:"Ri1-h1",e:6.667}],"-1#229252934":[{m:"Ch8-d8",e:6.667},{m:"Ch8-f8",e:6.667}],"1#442087051":[{m:"Hb1-c3",e:5}],"-1#1208081862":[{m:"Hh10-g8",e:5}],"1#-1965480309":[{m:"c4-c5",e:5}],"-1#1170872835":[{m:"Eg10-e8",e:5}],"1#-2036914436":[{m:"Hc3-d5",e:5}],"1#-827112081":[{m:"Hb1-a3",e:6.667},{m:"Cb3-d3",e:6.667}],"-1#-781321929":[{m:"Eg10-e8",e:5}],"-1#-194835820":[{m:"Hh10-g8",e:5}],"1#615108922":[{m:"Ri1-h1",e:5}],"-1#775195146":[{m:"Hh10-g8",e:5}],"1#-320048825":[{m:"Rh1-h7",e:5}],"-1#1443261242":[{m:"Hb10-c8",e:5}],"1#1192655238":[{m:"Cb3-b5",e:5}],"-1#1885284664":[{m:"Ri10-h10",e:5}],"1#706630857":[{m:"Hb1-c3",e:5}],"-1#2017869700":[{m:"g7-g6",e:5}],"1#219990265":[{m:"Ra1-b1",e:5}],"-1#1001404421":[{m:"Eg10-e8",e:5}],"1#-118684422":[{m:"e4-e5",e:5}],"-1#2137186742":[{m:"Ra10-b10",e:5}],"-1#2015197547":[{m:"g7-g6",e:7.5},{m:"Ch8-e8",e:7.5}],"1#222793238":[{m:"Hh1-g3",e:6.667}],"1#460589136":[{m:"Hh1-g3",e:5}],"-1#1422501272":[{m:"Hh10-g8",e:5}],"1#-1777246507":[{m:"Ri1-h1",e:5}],"-1#-1119856547":[{m:"Ch8-g8",e:9.967},{m:"Ec10-e8",e:9.967},{m:"Ch8-e8",e:9.967},{m:"Hb10-c8",e:9.967},{m:"Cb8-e8",e:9.967},{m:"Hb10-a8",e:9.967},{m:"Eg10-e8",e:9.967},{m:"Cb8-f8",e:9.967},{m:"g7-g6",e:9.967},{m:"Hh10-g8",e:9.967},{m:"Hh10-i8",e:9.967},{m:"c7-c6",e:9.967},{m:"Ch8-d8",e:9.967},{m:"Ch8-f8",e:9.967},{m:"Cb8-d8",e:9.967},{m:"Cb8-g8",e:9.967}],"1#-876906857":[{m:"i4-i5",e:5}],"-1#1973710583":[{m:"Ch8-g8",e:5}],"1#-35694325":[{m:"Hh1-i3",e:6.667}],"-1#-464430795":[{m:"Ri10-h10",e:6.667}],"1#-1106238268":[{m:"Ri1-h1",e:6.667}],"-1#-1265795084":[{m:"Cb8-f8",e:6.667},{m:"Rh10-h6",e:6.667}],"1#-2046560252":[{m:"Cb3-b5",e:5}],"-1#-1320507206":[{m:"Rh10-h4",e:5}],"1#1963673581":[{m:"Cb5-a5",e:5}],"-1#1478727189":[{m:"Hb10-a8",e:5}],"1#313841175":[{m:"Hb1-c3",e:5}],"-1#1089256794":[{m:"Ra10-b10",e:5}],"1#2023658435":[{m:"Ad1-e2",e:5}],"-1#932676291":[{m:"Ec10-e8",e:5}],"1#453345824":[{m:"Ca5-g5",e:5}],"-1#-429801443":[{m:"Cg8xg5",e:5}],"1#-2075336882":[{m:"g4xg5",e:5}],"-1#1334728817":[{m:"Rb10-b4",e:5}],"1#-1297505904":[{m:"c4-c5",e:5}],"-1#2109381912":[{m:"Cf8-f5",e:5}],"1#-1860979701":[{m:"Ch3-f3",e:5}],"-1#-1269833038":[{m:"Rh4xh1",e:5}],"1#1437513770":[{m:"Hi3xh1",e:5}],"-1#261287559":[{m:"Cf5xi5",e:5}],"1#1953449418":[{m:"Ra1-d1",e:5}],"-1#510529659":[{m:"a7-a6",e:5}],"1#441191801":[{m:"Hh1-g3",e:5}],"-1#1441898673":[{m:"Af10-e9",e:5}],"1#1499096099":[{m:"Rd1-d7",e:5}],"1#291161774":[{m:"Hb1-c3",e:5}],"-1#1124249059":[{m:"c7-c6",e:5}],"1#-2140842280":[{m:"Cb3-b5",e:5}],"-1#-1221851546":[{m:"Hb10-c8",e:5}],"1#-1506011942":[{m:"Cb5-h5",e:5}],"-1#-1329758848":[{m:"Rh6-d6",e:5}],"1#461682419":[{m:"Ra1-b1",e:5}],"-1#757614095":[{m:"Ra10-b10",e:5}],"1#358246550":[{m:"Rb1-b7",e:5}],"-1#898548533":[{m:"Ec10-e8",e:5}],"1#421315542":[{m:"Rh1-h2",e:5}],"-1#406418644":[{m:"i7-i6",e:5}],"1#399817227":[{m:"i5xi6",e:5}],"-1#-956651738":[{m:"Rd6xi6",e:5}],"1#1415170073":[{m:"Rh2-d2",e:5}],"-1#-1185549359":[{m:"Cb8-a8",e:5}],"1#1884798993":[{m:"Rb7-c7",e:5}],"-1#-1970634241":[{m:"g7-g6",e:5}],"1#-3115390":[{m:"Ch3-f3",e:5}],"-1#-628350917":[{m:"Cg8-f8",e:5}],"1#1924359081":[{m:"c4-c5",e:5}],"-1#-1113563359":[{m:"Rb10-c10",e:5}],"1#-839100892":[{m:"Ch5-d5",e:5}],"1#-1848485698":[{m:"Hb1-c3",e:8.75},{m:"Ch3-f3",e:8.75},{m:"Hh1-g3",e:8.75},{m:"c4-c5",e:8.75},{m:"g4-g5",e:8.75}],"-1#-1014352909":[{m:"c7-c6",e:5}],"1#15583432":[{m:"g4-g5",e:5}],"-1#1277574693":[{m:"Hb10-c8",e:5}],"-1#-1265758713":[{m:"Ri10-i9",e:5}],"1#-182134173":[{m:"Hh1-g3",e:5}],"-1#-1164347477":[{m:"Ri9-f9",e:5}],"1#-1361140151":[{m:"Ri1-h1",e:5}],"-1#-563088010":[{m:"Hb10-c8",e:5}],"1#-813701174":[{m:"g4-g5",e:5}],"-1#-2085351129":[{m:"Hh10-i8",e:5}],"1#198125275":[{m:"Hb1-c3",e:5}],"-1#1503088022":[{m:"c7-c6",e:5}],"-1#-585519533":[{m:"Hh10-i8",e:6.667}],"1#1432525231":[{m:"Hh1-g3",e:6.667}],"-1#450835559":[{m:"Ri10-i9",e:6.667},{m:"Ch8-f8",e:6.667}],"1#1534451715":[{m:"Ri1-i2",e:5}],"1#-567727770":[{m:"Hh1-g3",e:5}],"-1#-1852537682":[{m:"Hh10-g8",e:5}],"1#1397522403":[{m:"Ri1-h1",e:5}],"-1#1506878675":[{m:"Ri10-h10",e:5}],"1#59791650":[{m:"Hb1-c3",e:5}],"1#-1404024095":[{m:"c4-c5",e:8.571}],"-1#1665365609":[{m:"Ch8-e8",e:8.571},{m:"Cb8-a8",e:8.571},{m:"g7-g6",e:8.571}],"1#2754386":[{m:"Hb1-c3",e:5}],"-1#1383230495":[{m:"Hh10-g8",e:5}],"1#-1867868334":[{m:"Hh1-i3",e:5}],"-1#-1994090644":[{m:"Ri10-i9",e:5}],"1#-930200824":[{m:"Ch3-g3",e:5}],"-1#-697278674":[{m:"e7-e6",e:5}],"1#1956784729":[{m:"Cb3-b7",e:5}],"-1#1747886755":[{m:"e6-e5",e:5}],"1#-1438562903":[{m:"Hb1-c3",e:5}],"-1#-132567324":[{m:"Ra10-b10",e:5}],"1#-1066729347":[{m:"Ra1-b1",e:5}],"-1#-154668927":[{m:"Rb10-b6",e:5}],"1#-2049603305":[{m:"Cb3-a3",e:5}],"-1#-1236565893":[{m:"Rb6xb1",e:5}],"1#346600781":[{m:"Hc3xb1",e:5}],"-1#-1921782046":[{m:"Ch8-e8",e:5}],"1#370770196":[{m:"Hb1-c3",e:8},{m:"Ch3-h7",e:8},{m:"Hh1-g3",e:8}],"-1#1145170521":[{m:"Ec10-e8",e:6.667},{m:"Hh10-g8",e:6.667}],"-1#1646993326":[{m:"Hh10-g8",e:5}],"-1#1503931612":[{m:"Hh10-g8",e:5}],"1#-1998032907":[{m:"g4-g5",e:9.714},{m:"c4-c5",e:9.714},{m:"Hh1-g3",e:9.714},{m:"Hb1-c3",e:9.714},{m:"Hb1-d2",e:9.714}],"-1#-1004300008":[{m:"Hb10-c8",e:5}],"1#-718042204":[{m:"g4-g5",e:8.333}],"-1#1207653245":[{m:"Hb10-c8",e:7.5}],"1#1458258369":[{m:"Hb1-c3",e:7.5}],"-1#78850700":[{m:"Ra10-b10",e:8}],"1#1019282453":[{m:"Ra1-b1",e:8}],"-1#174978281":[{m:"Rb10-b4",e:8.75}],"-1#-950681027":[{m:"Hb10-c8",e:8.333}],"1#-700067711":[{m:"g4-g5",e:8.333},{m:"Hb1-c3",e:8.333},{m:"Ch3-i3",e:8.333}],"-1#-625998664":[{m:"Hb10-c8",e:9.6}],"1#-878701052":[{m:"Ra1-b1",e:9.6},{m:"Hb1-c3",e:7.5},{m:"Hb1-c3",e:8.333}],"-1#-49486088":[{m:"Ra10-a9",e:9.524}],"-1#1521450736":[{m:"Hb10-c8",e:5}],"1#1270836300":[{m:"Hh1-g3",e:5}],"-1#67289476":[{m:"Hh10-g8",e:5}],"1#-958776631":[{m:"g4-g5",e:5}],"-1#-1978545116":[{m:"Ri10-i9",e:9}],"1#-136898465":[{m:"g4-g5",e:6.667},{m:"Hb1-c3",e:6.667}],"-1#-1155731790":[{m:"Ra10-a9",e:5}],"1#-1555728397":[{m:"Hh1-g3",e:5}],"-1#-319235525":[{m:"Eg10-e8",e:5}],"1#799401668":[{m:"Ch3-i3",e:5}],"-1#1478371803":[{m:"g7-g6",e:5}],"1#759488166":[{m:"g5xg6",e:5}],"-1#1181337264":[{m:"Ra9-g9",e:5}],"1#-1385241002":[{m:"Ri1-h1",e:5}],"-1#-1477198490":[{m:"Rg9xg6",e:5}],"1#-1507760642":[{m:"Hg3-f5",e:5}],"-1#-254593383":[{m:"Rg6-f6",e:5}],"1#1611969099":[{m:"Rh1-h5",e:5}],"-1#-1517325550":[{m:"g7-g6",e:5}],"1#-791313297":[{m:"c4-c5",e:5}],"-1#533117159":[{m:"Hh10-g8",e:5}],"1#-585219158":[{m:"Hh1-g3",e:9.091},{m:"Hh1-i3",e:9.091}],"-1#-1834750366":[{m:"Cb8-d8",e:8},{m:"Ra10-a9",e:8},{m:"Eg10-e8",e:8}],"1#-1963296989":[{m:"a4-a5",e:5}],"-1#-997178476":[{m:"i7-i6",e:9.091},{m:"Eg10-e8",e:9.091},{m:"Ri10-i9",e:9.091}],"1#-2059757584":[{m:"Ad1-e2",e:5}],"1#2115855522":[{m:"Hb1-c3",e:8.333},{m:"c4-c5",e:8.333}],"-1#742723567":[{m:"Hh10-g8",e:6.667}],"1#-291638110":[{m:"c4-c5",e:6.667},{m:"Hh1-i3",e:6.667}],"-1#563005482":[{m:"Hh10-g8",e:7.5},{m:"Hb10-a8",e:6.667}],"1#1423195991":[{m:"Hc3-b5",e:9.5},{m:"Cb3-a3",e:9.5},{m:"Hh1-i3",e:9.5}],"-1#502714683":[{m:"Hg8-h6",e:5}],"1#-2143340108":[{m:"Cb3xb8",e:5}],"-1#1732916795":[{m:"Hb10-c8",e:5}],"1#1985619079":[{m:"Hh1-i3",e:5}],"-1#1297760105":[{m:"Hg8-h6",e:9.545},{m:"i7-i6",e:9.545}],"1#1796835368":[{m:"Ad1-e2",e:6.667},{m:"Hh1-i3",e:6.667}],"-1#605067560":[{m:"Ch8-i8",e:5}],"-1#-149687140":[{m:"Ch8-i8",e:5}],"1#-890071441":[{m:"Ri1-h1",e:5}],"-1#-1066414753":[{m:"Ri10-h10",e:5}],"1#-1708216146":[{m:"g4-g5",e:5}],"-1#-689617341":[{m:"c7-c6",e:5}],"-1#-1324459990":[{m:"g7-g6",e:7.5}],"1#-1001083049":[{m:"Hb1-c3",e:7.5}],"-1#-1777548262":[{m:"Hh10-g8",e:7.5}],"1#-1882267731":[{m:"Hb1-a3",e:9.868},{m:"Cb3-c3",e:9.868},{m:"g4-g5",e:9.868},{m:"Cb3-d3",e:9.868},{m:"Hh1-g3",e:9.868},{m:"c4-c5",e:9.868},{m:"Ra1-a2",e:9.868},{m:"Hh1-i3",e:9.868},{m:"Hb1-c3",e:9.868}],"-1#-1877974027":[{m:"Hb10-c8",e:5}],"1#-2130677431":[{m:"Hb1-a3",e:9.167}],"-1#-2061042508":[{m:"g7-g6",e:5}],"1#-260305975":[{m:"Ra1-a2",e:5}],"-1#-1023071936":[{m:"Hb10-c8",e:9.167}],"1#-770360324":[{m:"Hb1-a3",e:9.167}],"-1#-1256288170":[{m:"Hb10-c8",e:5}],"1#-1542552854":[{m:"Hb1-c3",e:5}],"-1#-1066175899":[{m:"g7-g6",e:8.75},{m:"Hb10-c8",e:8.75}],"-1#1088283429":[{m:"Hb10-c8",e:9}],"1#1372451225":[{m:"Cb3-d3",e:9}],"-1#110057222":[{m:"Hb10-c8",e:5}],"1#396314042":[{m:"Ra2-f2",e:5}],"-1#-1774133357":[{m:"Hb10-c8",e:5}],"1#-2024747729":[{m:"Ri1-i2",e:5}],"-1#-577325856":[{m:"Hb10-c8",e:9.773},{m:"c7-c6",e:9.773}],"1#-937775328":[{m:"Hh1-i3",e:9.545},{m:"Hb1-d2",e:9.545},{m:"c4-c5",e:9.545},{m:"Ch3-g3",e:9.545}],"-1#-778784994":[{m:"Cb8-e8",e:6.667},{m:"Eg10-e8",e:6.667}],"1#-465790794":[{m:"Ri1-i2",e:5}],"-1#-1317481250":[{m:"Hb10-c8",e:5}],"1#315200481":[{m:"Ri1-i2",e:5}],"-1#1200480137":[{m:"Eg10-e8",e:6.667}],"-1#442351141":[{m:"Cb8-e8",e:5}],"1#804620685":[{m:"Hd2-f3",e:5}],"-1#1356827043":[{m:"Hb10-c8",e:5}],"1#1104124703":[{m:"g4-g5",e:5}],"-1#218394098":[{m:"Ra10-b10",e:5}],"1#896942955":[{m:"Cb3-d3",e:5}],"-1#-689655034":[{m:"Eg10-e8",e:9.375},{m:"Hh10-i8",e:9.375},{m:"Ch8-e8",e:9.375},{m:"Ec10-e8",e:9.375}],"1#1587512570":[{m:"Hh1-i3",e:5}],"1#-1249000899":[{m:"g4-g5",e:5}],"1#2140709648":[{m:"Hb1-d2",e:9.767},{m:"c4-c5",e:9.767},{m:"Hb1-c3",e:9.767},{m:"g4-g5",e:9.767},{m:"Hh1-i3",e:9.767}],"-1#-1377848811":[{m:"Ch8-i8",e:5}],"1#-1874931482":[{m:"Ra1-c1",e:5}],"-1#880649898":[{m:"Ri10-h10",e:5}],"1#1849482075":[{m:"Ad1-e2",e:5}],"-1#767608925":[{m:"g7-g6",e:8},{m:"c7-c6",e:8}],"1#1486503712":[{m:"c4-c5",e:7.5}],"1#-291032218":[{m:"g4-g5",e:5}],"-1#861099517":[{m:"Ch8-i8",e:9.677},{m:"c7-c6",e:9.677},{m:"Cb8-e8",e:9.677}],"1#246560526":[{m:"Hh1-g3",e:6.667}],"1#-264982842":[{m:"Hh1-g3",e:8}],"-1#1712759598":[{m:"g7-g6",e:5}],"1#323769427":[{m:"Ec1-e3",e:5}],"1#893087649":[{m:"i4-i5",e:5}],"-1#-1960544319":[{m:"Ch8-g8",e:5}],"1#2116526950":[{m:"Hb1-c3",e:9.773},{m:"Hb1-d2",e:9.773},{m:"Ch3-f3",e:9.773},{m:"g4-g5",e:9.773},{m:"Hb1-a3",e:9.773},{m:"Cb3-c3",e:9.773},{m:"Ec1-e3",e:9.722},{m:"Ec1-e3",e:9.412}],"-1#746571819":[{m:"Hb10-c8",e:5}],"1#1030740631":[{m:"g4-g5",e:5}],"-1#-1402949021":[{m:"Ec10-e8",e:5}],"1#-2131578240":[{m:"Hh1-g3",e:5}],"-1#-816898232":[{m:"Hh10-i8",e:5}],"-1#1534850527":[{m:"Hb10-c8",e:6.667},{m:"Hh10-i8",e:6.667}],"1#1248585571":[{m:"Hh1-g3",e:5}],"1#-754925021":[{m:"Hh1-g3",e:5}],"-1#1643716414":[{m:"Hb10-c8",e:5}],"1#1894321538":[{m:"Hh1-g3",e:5}],"-1#1062510666":[{m:"Ec10-e8",e:5}],"1#331784361":[{m:"Cb3-d3",e:5}],"-1#1959755903":[{m:"Ec10-e8",e:8.889},{m:"Hb10-a8",e:8.889}],"1#1046003837":[{m:"Hh1-g3",e:5}],"1#-1431047792":[{m:"c4-c5",e:9.091},{m:"Hh1-g3",e:9.091},{m:"g4-g5",e:9.091},{m:"Hh1-i3",e:9.091}],"-1#-452043688":[{m:"Hh10-g8",e:6.667}],"1#668378901":[{m:"Ri1-h1",e:6.667}],"-1#759954469":[{m:"g7-g6",e:6.667}],"1#1477512024":[{m:"c4-c5",e:6.667}],"-1#-1761462320":[{m:"Ri10-i9",e:6.667},{m:"Ec10-e8",e:6.667}],"-1#-428341379":[{m:"Hh10-g8",e:7.5}],"1#614530096":[{m:"Ch3-f3",e:7.5},{m:"Hh1-g3",e:7.5}],"-1#33335945":[{m:"Hb10-c8",e:5}],"1#283949109":[{m:"Ri1-i2",e:5}],"-1#1797083640":[{m:"Ri10-h10",e:6.667}],"-1#-1287786066":[{m:"Hh10-g8",e:5}],"1#1910835939":[{m:"Ri1-i2",e:5}],"-1#614549131":[{m:"Ad10-e9",e:5}],"1#-933200262":[{m:"Ri2-d2",e:5}],"-1#1716376217":[{m:"Ec10-e8",e:5}],"1#1256182394":[{m:"Ch3-g3",e:5}],"1#2119762548":[{m:"Ri1-i2",e:9.787},{m:"Hh1-i3",e:9.787},{m:"g4-g5",e:9.787},{m:"c4-c5",e:9.787},{m:"Hh1-g3",e:9.787}],"-1#723340828":[{m:"Hh10-g8",e:9.286},{m:"Hh10-i8",e:9.286}],"1#-372918959":[{m:"Ri2-f2",e:8.75},{m:"Hh1-i3",e:8.75}],"1#-1553565216":[{m:"Ri2-f2",e:8.571}],"-1#1742144074":[{m:"Hh10-g8",e:8},{m:"i7-i6",e:8}],"1#-1525679865":[{m:"Ri1-h1",e:6.667}],"-1#-1349344713":[{m:"g7-g6",e:6.667}],"1#1748683925":[{m:"Ri1-h1",e:6.667}],"-1#848491673":[{m:"Hb10-c8",e:9.091},{m:"Hh10-i8",e:9.091}],"1#595781157":[{m:"Hh1-g3",e:5}],"1#-1159085211":[{m:"Hh1-g3",e:9}],"-1#-1320534276":[{m:"g7-g6",e:8},{m:"Hh10-g8",e:8}],"1#-1005532799":[{m:"Ch3-h7",e:7.5}],"1#1938998705":[{m:"Hh1-g3",e:5}],"-1#837070780":[{m:"Hh10-g8",e:9.375},{m:"g7-g6",e:9.375},{m:"Hh10-i8",e:9.375}],"1#1153325249":[{m:"Ch3-h9",e:9.091}],"1#-804926290":[{m:"c4-c5",e:9.167},{m:"g4-g5",e:9.167},{m:"Hb1-c3",e:9.167}],"-1#521596966":[{m:"Hb10-a8",e:6.667}],"1#1434562596":[{m:"Hb1-c3",e:6.667}],"-1#131717993":[{m:"Ra10-b10",e:6.667}],"1#1068234224":[{m:"Ra1-b1",e:6.667}],"-1#151454988":[{m:"Rb10-b6",e:6.667}],"1#2048228506":[{m:"Cb3-a3",e:6.667}],"-1#1233876470":[{m:"Rb6-f6",e:6.667},{m:"Rb6-d6",e:6.667}],"-1#-1664206269":[{m:"Hb10-c8",e:6.667},{m:"Hb10-a8",e:6.667}],"1#-1914820353":[{m:"Hh1-g3",e:5}],"-1#-1033665225":[{m:"Ra10-b10",e:5}],"1#-99505234":[{m:"Hg3-f5",e:5}],"1#-698779071":[{m:"Hb1-c3",e:5}],"-1#-2080304884":[{m:"Ra10-b10",e:5}],"1#-1133297771":[{m:"Ra1-b1",e:5}],"-1#-2107791389":[{m:"c7-c6",e:8.75},{m:"Hb10-c8",e:8.75}],"1#1094343896":[{m:"Ra1-b1",e:8.571},{m:"g4-g5",e:8.571}],"-1#2006363172":[{m:"Hb10-c8",e:5}],"1#-1823623841":[{m:"Ra1-b1",e:5}],"-1#-1511963229":[{m:"Ra10-b10",e:5}],"1#-1651283142":[{m:"g4-g5",e:5}],"1#-1269095836":[{m:"Ra1-a2",e:5}],"-1#1025157839":[{m:"Ra10-a8",e:5}],"1#-467797481":[{m:"g4-g5",e:5}],"-1#-1462366982":[{m:"Ra8-f8",e:5}],"1#-1356476892":[{m:"Hh1-g3",e:5}],"-1#-526883860":[{m:"Eg10-e8",e:5}],"1#600137491":[{m:"Ri1-i2",e:5}],"-1#1988170619":[{m:"Hb10-c8",e:5}],"1#1737556423":[{m:"Ra2-f2",e:5}],"-1#-709654293":[{m:"Hh10-f9",e:5}],"1#584246760":[{m:"c4-c5",e:5}],"-1#-306063008":[{m:"Ri10-g10",e:5}],"1#1249452329":[{m:"Hg3-f5",e:5}],"-1#478900814":[{m:"Rf8-f6",e:5}],"1#-2082893630":[{m:"Hf5-d4",e:5}],"-1#1514312584":[{m:"Rf6-h6",e:5}],"1#374525253":[{m:"Ch3-g3",e:5}],"-1#145543523":[{m:"Hf9-d8",e:5}],"1#-917707055":[{m:"Rf2-f7",e:5}],"-1#620618042":[{m:"g7-g6",e:5}],"1#1369904711":[{m:"Cb3-b7",e:5}],"-1#1294704317":[{m:"g6xg5",e:5}],"1#-672180598":[{m:"Rf7-g7",e:5}],"-1#1305104742":[{m:"Rh6-d6",e:5}],"1#-262124283":[{m:"Ri2-h2",e:5}],"-1#-1365447329":[{m:"g5-h5",e:5}],"1#-115464985":[{m:"Cb7xe7+",e:5}],"-1#2147088503":[{m:"Hh10-g8",e:6.667},{m:"g7-g6",e:6.667}],"1#-1121909958":[{m:"c4-c5",e:5}],"-1#1915895730":[{m:"g7-g6",e:5}],"1#124307663":[{m:"Hb1-c3",e:5}],"-1#1429250946":[{m:"Hb10-c8",e:5}],"1#1142993214":[{m:"Hh1-g3",e:5}],"-1#194845942":[{m:"Cb8-b4",e:5}],"1#-1236249102":[{m:"Hc3-b5",e:5}],"-1#-9258082":[{m:"Cb4xg4",e:5}],"1#18626063":[{m:"Eg1-e3",e:5}],"-1#-2021314339":[{m:"g6-g5",e:5}],"1#-32188822":[{m:"Ee3xg5",e:5}],"-1#-1831550626":[{m:"Hg8-f6",e:5}],"1#816125421":[{m:"Ch5-i5",e:5}],"-1#-621935761":[{m:"Ri10-h10",e:5}],"1#-2135982434":[{m:"Eg5-e3",e:5}],"-1#-818361733":[{m:"Ch8-h5",e:5}],"1#397283508":[{m:"Hb5xc7",e:5}],"-1#-461876831":[{m:"i7-i6",e:5}],"1#-342515842":[{m:"Hc7-d5",e:5}],"-1#-170873064":[{m:"Hf6-g8",e:5}],"1#1470200747":[{m:"Cb3-c3",e:5}],"-1#1565087922":[{m:"Hc8-b6",e:5}],"1#-2095280189":[{m:"c5-c6",e:5}],"-1#-322479745":[{m:"Hb6-c4",e:5}],"1#-1016687990":[{m:"Ri1-h1",e:5}],"-1#-906245702":[{m:"i6xi5",e:5}],"1#463508382":[{m:"i4xi5",e:5}],"-1#1923725709":[{m:"Ch5-h4",e:5}],"1#-1838452903":[{m:"Af1-e2",e:5}],"-1#-902658669":[{m:"Ra10-b10",e:5}],"1#-230642934":[{m:"c6-b6",e:5}],"-1#-1838602790":[{m:"Hc4xb6",e:5}],"1#-1858768871":[{m:"Ra1-b1",e:5}],"-1#-1483112219":[{m:"Hb6-c8",e:5}],"1#2043434900":[{m:"Rb1xb10",e:5}],"-1#-384415081":[{m:"Hc8xb10",e:5}],"1#1869811227":[{m:"Hd5-c7",e:5}],"-1#1899380349":[{m:"Ec10-e8",e:5}],"1#1571045022":[{m:"Rh1-f1",e:5}],"-1#1739115029":[{m:"Rh10-h6",e:5}],"1#-1031834801":[{m:"Rf1-f9",e:5}],"-1#418155545":[{m:"Rh6-f6",e:5}],"1#101100948":[{m:"Rf9-b9",e:5}],"-1#-1866416139":[{m:"Rf6-c6",e:5}],"1#1705539864":[{m:"Cc3-b3",e:5}],"-1#1866488321":[{m:"Rc6xc7",e:5}],"1#-1090947395":[{m:"Cb3xb10+",e:5}],"-1#1004888291":[{m:"Rc7-c10",e:5}],"1#99931759":[{m:"Rb9-h9",e:5}],"-1#2017346332":[{m:"Rc10xb10",e:5}],"1#1336003367":[{m:"Rh9xh4",e:5}],"-1#958696747":[{m:"Hg8-f6",e:5}],"1#-1688905320":[{m:"i5-i6",e:5}],"-1#-1790145163":[{m:"Rb10-b5",e:5}],"1#-818009397":[{m:"Hg3-f1",e:5}],"-1#2084935614":[{m:"Cg4xa4",e:5}],"1#-1924665693":[{m:"e4-e5",e:5}],"-1#180882415":[{m:"Ca4-a5",e:5}],"1#-346052645":[{m:"Rh4-f4",e:5}],"-1#1346478587":[{m:"Hf6-d7",e:5}],"1#1017641144":[{m:"Hf1-g3",e:5}],"-1#-1881389619":[{m:"Rb5xe5",e:5}],"1#1723362912":[{m:"Rf4-d4",e:5}],"-1#-1722382371":[{m:"Hd7-b8",e:5}],"1#-1266470946":[{m:"Rd4-d6",e:5}],"-1#398286476":[{m:"Hb8-c6",e:5}],"1#660768931":[{m:"Rd6-f6",e:5}],"-1#-1285103117":[{m:"Ca5-a6",e:5}],"1#298264309":[{m:"Rf6-f7",e:5}],"-1#-1767701255":[{m:"Ca6xi6",e:5}],"1#-1348248473":[],"1#178458378":[{m:"Hb1-c3",e:5}],"-1#1492870215":[{m:"c7-c6",e:5}],"1#-1684234372":[{m:"Eg1-e3",e:5}],"-1#486906286":[{m:"Hb10-c8",e:5}],"1#202738450":[{m:"Ch5-i5",e:5}],"-1#-430006896":[{m:"Hh10-i8",e:5}],"1#1847962220":[{m:"Ci5-e5+",e:5}],"-1#-564627324":[{m:"Eg10-e8",e:5}],"1#486884475":[{m:"Hh1-g3",e:5}],"-1#1387850163":[{m:"Af10-e9",e:5}],"1#1578315041":[{m:"g4-g5",e:5}],"-1#316201932":[{m:"g6xg5",e:5}],"1#-2011425797":[{m:"Ee3xg5",e:5}],"-1#-455342897":[{m:"Ch8-f8",e:5}],"1#667246310":[{m:"Hg3-f5",e:5}],"-1#1899433345":[{m:"Cb8-b5",e:5}],"1#1060523524":[{m:"c4-c5",e:5}],"-1#-265981300":[{m:"Cb5xe5+",e:5}],"1#77643676":[{m:"e4xe5",e:5}],"-1#775180654":[{m:"c6xc5",e:5}],"1#357335290":[{m:"Cb3-b8",e:5}],"-1#497044491":[{m:"c5-c4",e:5}],"1#901498500":[{m:"Hc3-e4",e:5}],"-1#138155273":[{m:"Hc8-d6",e:5}],"1#579780234":[{m:"Cb8xf8",e:5}],"-1#1676437237":[{m:"Hd6xe4",e:5}],"1#1034844798":[{m:"Cf8-h8",e:5}],"-1#-1594149636":[{m:"He4xg5",e:5}],"1#668752103":[{m:"Ra1-a3",e:5}],"-1#1171284046":[{m:"Ri10-f10",e:5}],"1#-872097910":[{m:"Hf5xe7",e:5}],"-1#-653188968":[{m:"Hg5-f3+",e:5}],"1#1134808825":[{m:"Ke1-e2",e:5}],"-1#-479202058":[{m:"Hf3-d4+",e:5}],"1#-2057246358":[{m:"Ra3-d3",e:5}],"-1#-1465756165":[{m:"Ra10-b10",e:5}],"1#-1865385118":[{m:"Ri1-i3",e:5}],"-1#890210654":[{m:"Rf10xf1",e:5}],"1#-1351870331":[{m:"Ri3-g3",e:5}],"-1#-196348869":[{m:"Rb10-b2+",e:5}],"1#1500901782":[{m:"Ke2-e3",e:5}],"-1#609483384":[{m:"Rf1-e1+",e:5}],"1#988288300":[],"-1#721084621":[{m:"Ec10-e8",e:9.986},{m:"Ch8-d8",e:9.986},{m:"Cb8-g8",e:9.986},{m:"Hh10-i8",e:9.986},{m:"Ch8-f8",e:9.986},{m:"Ch8-e8",e:9.986},{m:"Cb8-f8",e:9.986},{m:"Hb10-c8",e:9.986},{m:"g7-g6",e:9.986},{m:"Ri10-i9",e:9.986},{m:"Cb8-e8",e:9.986},{m:"Hh10-g8",e:9.986},{m:"c7-c6",e:9.986},{m:"Ch8-h7",e:9.986},{m:"Eg10-e8",e:9.986},{m:"Cb8-d8",e:9.986}],"1#107536430":[{m:"Hh1-g3",e:8.333},{m:"Hb1-c3",e:8.333},{m:"Cb3-e3",e:8.333}],"-1#1238715878":[{m:"Ri10-i9",e:7.5}],"1#142580098":[{m:"Hb1-c3",e:7.5},{m:"Ri1-h1",e:7.5}],"-1#1512567503":[{m:"Hh10-i8",e:5}],"1#-765672141":[{m:"Ri1-h1",e:5}],"-1#-658399741":[{m:"Ri9-f9",e:5}],"-1#48415410":[{m:"Ri9-f9",e:6.667}],"1#379917136":[{m:"Hb1-c3",e:6.667}],"-1#1412467555":[{m:"Hh10-i8",e:5}],"1#-599016289":[{m:"Hh1-g3",e:5}],"-1#-1812590249":[{m:"Ri10-h10",e:5}],"1#-910725978":[{m:"g4-g5",e:5}],"-1#-2055431605":[{m:"Hb10-c8",e:5}],"1#-1804826377":[{m:"Ri1-h1",e:5}],"-1#-1628318777":[{m:"c7-c6",e:5}],"1#1570121980":[{m:"Ec1-e3",e:9.333}],"-1#-1406634060":[{m:"Ri10-i9",e:5}],"1#-310205488":[{m:"Hb1-c3",e:5}],"-1#-1076180835":[{m:"Ri9-f9",e:5}],"1#-1415767681":[{m:"Ce3xe7+",e:5}],"-1#204678177":[{m:"Ad10-e9",e:5}],"1#-521003824":[{m:"Ad1-e2",e:5}],"-1#-1342501424":[{m:"Hb10-c8",e:5}],"1#-1091887252":[{m:"Ce7-e5",e:5}],"1#1024018688":[{m:"Hh1-g3",e:5}],"-1#1924457672":[{m:"Hh10-g8",e:5}],"1#-1335091323":[{m:"Ri1-h1",e:5}],"-1#-1158593355":[{m:"Ri10-i9",e:5}],"1#-77885231":[{m:"Hb1-c3",e:5}],"-1#-1459356772":[{m:"Ri9-f9",e:5}],"1#-1119606146":[{m:"Rh1-h5",e:5}],"-1#764388566":[{m:"c7-c6",e:5}],"1#-286760979":[{m:"Rh5-d5",e:5}],"-1#-170018228":[{m:"Hb10-c8",e:5}],"1#-456283920":[{m:"Rd5-d7",e:5}],"-1#27540926":[{m:"Ra10-a8",e:5}],"1#-660378266":[{m:"Ad1-e2",e:5}],"-1#-1750434714":[{m:"Af10-e9",e:5}],"1#-1694385932":[{m:"g4-g5",e:5}],"-1#-674607591":[{m:"Rf9-f6",e:5}],"1#1666952889":[{m:"Cb3-b5",e:5}],"-1#1410530823":[{m:"Cb8-b9",e:5}],"1#-1452721012":[{m:"Cb5-f5",e:5}],"-1#-436512475":[{m:"Rf6-d6",e:5}],"1#1307935914":[{m:"Rd7xd6",e:5}],"-1#-1382126133":[{m:"Hc8xd6",e:5}],"1#1630289947":[{m:"Ra1-b1",e:5}],"-1#1468051687":[{m:"Cb9-c9",e:5}],"1#-207128799":[{m:"Ec1-e3",e:5}],"-1#1094818056":[{m:"a7-a6",e:5}],"1#1164149770":[{m:"Rb1-b9",e:5}],"1#601987828":[{m:"c4-c5",e:5}],"-1#-319641988":[{m:"Hh10-i8",e:5}],"1#1686737280":[{m:"i4-i5",e:5}],"-1#-627668512":[{m:"Ra10-a8",e:5}],"1#59889976":[{m:"Hh1-i3",e:5}],"-1#438294790":[{m:"Ra8-f8",e:5}],"1#502012888":[{m:"Ad1-e2",e:5}],"-1#1390742232":[{m:"Hb10-c8",e:5}],"1#1140136036":[{m:"Hb1-c3",e:5}],"-1#296579881":[{m:"Cg8-g9",e:5}],"1#2047396322":[{m:"Ec1-e3",e:5}],"-1#-923916341":[{m:"Rf8-f6",e:5}],"1#1471989063":[{m:"Ri1-h1",e:5}],"-1#1562484343":[{m:"Ri10-h10",e:5}],"1#123790214":[{m:"Ra1-d1",e:5}],"-1#1835120183":[{m:"i7-i6",e:5}],"1#1653373160":[{m:"i5xi6",e:5}],"-1#-1281202747":[{m:"Rf6xi6",e:5}],"1#-1807623296":[{m:"Rh1-h5",e:5}],"-1#76174632":[{m:"Ri6-b6",e:5}],"1#2054219061":[{m:"Hc3-d5",e:5}],"-1#1345526536":[{m:"Hi8-h6",e:5}],"1#-2024194250":[{m:"Rh5-i5",e:5}],"-1#-963194982":[{m:"g7-g6",e:5}],"1#-1278461721":[{m:"Ri5-i9",e:5}],"-1#-167698323":[{m:"Cg9-g7",e:5}],"1#-1444144065":[{m:"Ri9-f9",e:5}],"1#-1568549071":[{m:"c4-c5",e:9.545},{m:"g4-g5",e:9.545},{m:"Hh1-i3",e:9.545},{m:"Hh1-g3",e:9.545},{m:"Cb3-e3",e:9.545}],"-1#1838345145":[{m:"Ri10-h10",e:5}],"1#936613448":[{m:"Hh1-g3",e:5}],"-1#2020490112":[{m:"Cb8-e8",e:6.667},{m:"Ch8-g8",e:6.667}],"-1#-297131556":[{m:"Ri10-i9",e:5}],"1#-1344211528":[{m:"Hh1-g3",e:5}],"-1#-530753424":[{m:"Ri9-f9",e:5}],"1#-199587438":[{m:"Ad1-e2",e:5}],"-1#-1156589809":[{m:"Ri10-h10",e:5}],"1#-514938114":[{m:"Ri1-h1",e:5}],"-1#-338431538":[{m:"Cb8-e8",e:5}],"1#-562313626":[{m:"Hb1-c3",e:5}],"-1#-1943818965":[{m:"Hb10-c8",e:5}],"-1#-314803463":[{m:"Ri10-h10",e:9.444},{m:"Hh10-i8",e:9.375},{m:"Hh10-i8",e:9.474},{m:"g7-g6",e:9.444}],"1#-1399411043":[{m:"Ri1-h1",e:6.667}],"1#-541917943":[{m:"Ri1-h1",e:9.5},{m:"Cb3-e3",e:9.5},{m:"c4-c5",e:9.5}],"-1#146882731":[{m:"Cb8-e8",e:5}],"1#1030321923":[{m:"Hb1-c3",e:5}],"-1#1865489486":[{m:"Hb10-c8",e:5}],"1#2116095730":[{m:"Hh1-g3",e:5}],"-1#832348986":[{m:"Ri10-h10",e:5}],"1#-370951452":[{m:"g4-g5",e:8},{m:"Hb1-c3",e:8},{m:"Hh1-i3",e:8}],"-1#-1524085751":[{m:"Hh10-i8",e:5}],"1#760445941":[{m:"Hh1-g3",e:5}],"-1#1659819581":[{m:"Ri10-h10",e:5}],"1#951036876":[{m:"Hb1-c3",e:5}],"-1#1794621569":[{m:"c7-c6",e:5}],"1#-1450165318":[{m:"Cb3-a3",e:5}],"-1#-1710345514":[{m:"Hb10-c8",e:5}],"1#-1960959894":[{m:"Ra1-b1",e:5}],"-1#-1145318999":[{m:"Hh10-g8",e:5}],"1#2036542180":[{m:"Hh1-i3",e:5}],"-1#1626155738":[{m:"Ri10-h10",e:5}],"1#984373035":[{m:"Ri1-i2",e:5}],"-1#1877482307":[{m:"Cb8-e8",e:5}],"1#1514155243":[{m:"Ri2-d2",e:5}],"-1#-194150392":[{m:"Hb10-c8",e:5}],"1#-444755276":[{m:"Ra1-b1",e:5}],"-1#-741252536":[{m:"c7-c6",e:5}],"-1#-261244198":[{m:"Hh10-g8",e:6.667},{m:"g7-g6",e:6.667}],"1#850739607":[{m:"Ri1-h1",e:5}],"-1#942152359":[{m:"c7-c6",e:5}],"1#-78650980":[{m:"c4-c5",e:5}],"-1#878501140":[{m:"c6xc5",e:5}],"1#-2059973209":[{m:"Ri1-h1",e:8}],"-1#-1884678505":[{m:"Hh10-g8",e:8}],"1#1234407926":[{m:"Ch3-f3",e:9.091},{m:"Cb3-e3",e:9.583}],"-1#-472709524":[{m:"Hh10-g8",e:6.667}],"1#554433825":[{m:"Hb1-c3",e:6.667}],"-1#1934857836":[{m:"Hb10-a8",e:6.667}],"1#969201262":[{m:"Ra1-b1",e:6.667},{m:"Hh1-g3",e:6.667}],"-1#258483858":[{m:"Ra10-b10",e:5}],"1#924452875":[{m:"Hh1-g3",e:5}],"-1#2024252867":[{m:"Ri10-h10",e:5}],"1#585553970":[{m:"Rb1-b5",e:5}],"-1#2051598857":[{m:"Rh10-h6",e:5}],"-1#1987672998":[{m:"Ri10-h10",e:5}],"1#741869143":[{m:"g4-g5",e:5}],"-1#1626599610":[{m:"Cb8-c8",e:5}],"1#-334644520":[{m:"Ra1-b1",e:5}],"1#410281789":[{m:"g4-g5",e:9.792},{m:"Hh1-g3",e:9.792},{m:"Hh1-i3",e:9.792},{m:"c4-c5",e:9.792},{m:"Cb3-e3",e:9.792},{m:"Hb1-c3",e:9.792}],"-1#1421840848":[{m:"Hh10-i8",e:5}],"1#-591092180":[{m:"Hh1-g3",e:5}],"-1#-1820783644":[{m:"c7-c6",e:5}],"1#1344205023":[{m:"Hb1-c3",e:5}],"-1#1472842485":[{m:"Hh10-i8",e:9.474}],"-1#33187587":[{m:"Hh10-i8",e:7.5}],"1#-1988013825":[{m:"Ri1-h1",e:7.5}],"-1#-2095313969":[{m:"Ri10-h10",e:7.5}],"-1#-681092171":[{m:"Hb10-c8",e:9}],"1#-965261047":[{m:"Hb1-c3",e:9},{m:"Hh1-g3",e:9}],"-1#-1305153369":[{m:"Hb10-c8",e:5}],"1#-1557863909":[{m:"Hb1-c3",e:5}],"-1#-243496618":[{m:"Ec10-e8",e:5}],"1#-571569739":[{m:"Ra1-b1",e:5}],"-1#1244400752":[{m:"Hb10-c8",e:9.375}],"1#1530666700":[{m:"Hh1-g3",e:9.375},{m:"Ra1-b1",e:9.375}],"1#1005253233":[{m:"c4-c5",e:8.333},{m:"Hh1-g3",e:8.333}],"-1#-184955143":[{m:"Cb8-a8",e:5}],"1#1039924537":[{m:"Hb1-c3",e:5}],"-1#1872991860":[{m:"Ra10-b10",e:5}],"1#1473362157":[{m:"Ra1-b1",e:5}],"-1#1635600401":[{m:"Rb10-b6",e:5}],"1#309277063":[{m:"Cb3-a3",e:5}],"-1#569456875":[{m:"Rb6xb1",e:5}],"1#-2095968803":[{m:"Hc3xb1",e:5}],"-1#449402482":[{m:"g7-g6",e:5}],"1#1871945999":[{m:"Hh1-i3",e:5}],"-1#1981653297":[{m:"Hh10-g8",e:5}],"1#-1262134660":[{m:"Ri1-h1",e:5}],"-1#1951883193":[{m:"Hh10-i8",e:8},{m:"Ch8-f8",e:8}],"1#-64198587":[{m:"Ri1-h1",e:7.5},{m:"g4-g5",e:7.5}],"-1#-156159115":[{m:"Ri10-h10",e:5}],"1#-1393537404":[{m:"c4-c5",e:5}],"-1#-1326997848":[{m:"c7-c6",e:6.667},{m:"Ri10-h10",e:6.667}],"1#-1219623536":[{m:"Ri1-h1",e:5}],"-1#-1110221152":[{m:"Hh10-g8",e:5}],"1#2131469805":[{m:"g4-g5",e:5}],"-1#868242176":[{m:"c7-c6",e:6.667},{m:"Eg10-e8",e:6.667}],"1#1604327344":[{m:"Cb3-e3",e:9.947},{m:"Hh1-i3",e:9.947},{m:"Ch3-f3",e:9.924},{m:"c4-c5",e:9.947}],"-1#-169836502":[{m:"Hh10-g8",e:8.889},{m:"Cb8-e8",e:8.889},{m:"Hb10-c8",e:8.889}],"1#926448487":[{m:"Hh1-g3",e:8.333}],"1#-1068976254":[{m:"Hh1-i3",e:5}],"1#-453995882":[{m:"Hh1-i3",e:6.667}],"-1#1177425806":[{m:"Ch8-d8",e:9.943},{m:"Ch8-h4",e:9.943},{m:"Cb8-e8",e:9.943},{m:"g7-g6",e:8.571},{m:"Ch8-e8",e:9.943},{m:"g7-g6",e:6.667}],"-1#-1867306184":[{m:"Hh10-g8",e:8}],"1#1382797429":[{m:"Hh1-i3",e:8},{m:"Hb1-c3",e:8},{m:"Hh1-g3",e:8}],"-1#1273352267":[{m:"Ri10-h10",e:6.667}],"-1#3390264":[{m:"Ri10-h10",e:6.667}],"1#1800418473":[{m:"Hb1-c3",e:9.655},{m:"Hh1-i3",e:9.655},{m:"g4-g5",e:9.655},{m:"Cb3-e3",e:9.655},{m:"Hh1-g3",e:9.655}],"-1#956850148":[{m:"Hb10-c8",e:6.667},{m:"Ri9-f9",e:6.667}],"1#672681304":[{m:"c4-c5",e:5}],"1#760188422":[{m:"Ad1-e2",e:5}],"-1#1927165079":[{m:"Ri9-f9",e:8.75},{m:"Ch8-e8",e:8.75},{m:"Ec10-e8",e:8.75}],"1#1721361781":[{m:"Ad1-e2",e:8.333}],"1#297223596":[{m:"Hb1-c3",e:5}],"-1#664519236":[{m:"Ri9-f9",e:5}],"1#870060966":[{m:"Ad1-e2",e:5}],"-1#2094334630":[{m:"Hh10-i8",e:5}],"1#-189909670":[{m:"Cb3-e3",e:5}],"-1#-1055874253":[{m:"Hb10-c8",e:7.5
}],"1#-805260913":[{m:"Hb1-c3",e:7.5}],"-1#-2108106046":[{m:"Ri9-f9",e:7.5},{m:"Ra10-b10",e:7.5}],"1#-1171590053":[{m:"Ra1-b1",e:5}],"-1#619551073":[{m:"Ri9-f9",e:9.375},{m:"Hh10-i8",e:9.375}],"1#816466051":[{m:"Ad1-e2",e:9.333}],"1#525522789":[{m:"Cb3-e3",e:9.967},{m:"Hh1-g3",e:9.967},{m:"Ch3-f3",e:9.333}],"-1#-1257094913":[{m:"Ce8xe4+",e:9},{m:"Ra10-a9",e:9},{m:"Hb10-c8",e:9}],"1#-142665394":[{m:"Af1-e2",e:7.5}],"-1#-1356401788":[{m:"Ch8-e8",e:7.5}],"1#-1387537986":[{m:"Hh1-g3",e:5}],"-1#-487164810":[{m:"Ra9-f9",e:5}],"1#-1543351741":[{m:"Hb1-c3",e:8.333}],"-1#-161859314":[{m:"Hh10-g8",e:8.333}],"-1#1357871789":[{m:"Hb10-c8",e:5}],"1#1107257361":[{m:"Hb1-c3",e:5}],"-1#329712476":[{m:"Ra10-b10",e:9.946},{m:"Ri10-i9",e:9.946},{m:"Ch8-g8",e:9.946},{m:"g7-g6",e:9.946},{m:"Hh10-i8",e:9.946}],"1#735391173":[{m:"Ri1-h1",e:8.571}],"1#1376638776":[{m:"Ri1-h1",e:5}],"1#1700539798":[{m:"Ri1-h1",e:5}],"1#-400417920":[{m:"Hh1-i3",e:9.877},{m:"Hh1-g3",e:9.877},{m:"c4-c5",e:9.877},{m:"Hb1-c3",e:9.877},{m:"g4-g5",e:9.877}],"-1#-240378946":[{m:"Cb8-e8",e:8.571},{m:"Ri10-h10",e:8.571},{m:"g7-g6",e:8.571}],"1#-1410505137":[{m:"Ri1-h1",e:8}],"-1#-1482705336":[{m:"Ri10-h10",e:8.75},{m:"g7-g6",e:8.75}],"1#-35730503":[{m:"Ri1-h1",e:8.571},{m:"g4-g5",e:8.571}],"1#-758824651":[{m:"Ri1-h1",e:5}],"-1#657532680":[{m:"Hb10-a8",e:5}],"1#1839621898":[{m:"Hb1-c3",e:5}],"-1#1073613895":[{m:"Eg10-e8",e:5}],"1#-56414024":[{m:"Hh1-i3",e:5}],"-1#-1166380851":[{m:"Ri10-h10",e:5}],"1#-533000900":[{m:"Hh1-g3",e:5}],"-1#-1350131468":[{m:"g7-g6",e:5}],"1#-623093879":[{m:"c4-c5",e:5}],"-1#-1528173203":[{m:"c7-c6",e:9.848},{m:"Cb8-e8",e:9.848},{m:"Ri10-h10",e:9.848},{m:"Ch8-i8",e:9.848}],"1#-1857955131":[{m:"Hb1-c3",e:9.091}],"1#-375579658":[{m:"Hh1-g3",e:9.583},{m:"Hh1-i3",e:9.583},{m:"Cb3-e3",e:9.583},{m:"Ch3-f3",e:9.981}],"-1#-1507805634":[{m:"Hh10-g8",e:9.412},{m:"Hb10-c8",e:9.412},{m:"Hh10-i8",e:9.412}],"1#1693994355":[{m:"Cb3-e3",e:8.889}],"1#-1221548926":[{m:"Ri1-h1",e:5}],"1#777748930":[{m:"Hb1-c3",e:8.75}],"-1#-267183160":[{m:"Hh10-g8",e:6.667}],"1#852222085":[{m:"Ri1-h1",e:6.667}],"-1#945208245":[{m:"Ri10-h10",e:6.667}],"1#1645725252":[{m:"Rh1-h5",e:6.667}],"-1#-220444436":[{m:"Hb10-c8",e:6.667},{m:"Ch8-i8",e:6.667}],"-1#1138592876":[{m:"Hb10-c8",e:5}],"1#1389207248":[{m:"Hb1-c3",e:5}],"-1#9827741":[{m:"Ra10-b10",e:7.5},{m:"Ri10-i9",e:7.5}],"1#954718980":[{m:"Hh1-g3",e:6.667}],"1#1094656505":[{m:"Hh1-g3",e:5}],"1#1833512762":[{m:"Hb1-c3",e:5}],"-1#1058096247":[{m:"c7-c6",e:5}],"1#-59326644":[{m:"Hh1-g3",e:5}],"-1#-1278537084":[{m:"Cb8-h8",e:5}],"1#336233814":[{m:"Cb3-b8",e:5}],"-1#484854183":[{m:"Ec10-a8",e:5}],"1#-1209158682":[{m:"Ra1-b1",e:5}],"-1#-2126429414":[{m:"Hb10-d9",e:5}],"1#-1956430848":[{m:"g4-g5",e:5}],"-1#-945239315":[{m:"Ra10-b10",e:5}],"1#-2431884":[{m:"Cb8-b7",e:5}],"-1#-160983282":[{m:"Hh10-i8",e:5}],"1#2115805426":[{m:"Ec1-e3",e:5}],"-1#-856011045":[{m:"Ri10-h10",e:5}],"1#-1766116566":[{m:"Ri1-i2",e:5}],"-1#-1006665918":[{m:"Ch8-f8",e:5}],"1#1265457169":[{m:"Ri2-d2",e:5}],"-1#-448727822":[{m:"Rb10-b9",e:5}],"1#-1172870354":[{m:"Cf3-f5",e:5}],"-1#1164559675":[{m:"Eg10-e8",e:5}],"1#-2043348540":[{m:"g5-g6",e:5}],"-1#-466061609":[{m:"Ch7-h2",e:5}],"1#1238596070":[{m:"g6xg7",e:5}],"-1#1946786013":[{m:"Rh10-h3",e:5}],"1#-590297951":[{m:"Rd2-g2",e:5}],"-1#-2125660298":[{m:"Ch2-h1",e:5}],"1#625087221":[{m:"Ad1-e2",e:5}],"1#-374875086":[{m:"Hh1-g3",e:6.667},{m:"Hh1-i3",e:6.667}],"-1#-1508216326":[{m:"Hh10-f9",e:5}],"1#1367022841":[{m:"Ri1-h1",e:5}],"-1#1541818313":[{m:"c7-c6",e:5}],"1#-1736327950":[{m:"Hb1-c3",e:5}],"-1#-891693121":[{m:"Hb10-c8",e:5}],"1#-607533821":[{m:"Rh1-h5",e:5}],"-1#1258441643":[{m:"Ch8-g8",e:5}],"1#1039754593":[{m:"Ec1-e3",e:5}],"-1#-1893758136":[{m:"Ri10-h10",e:5}],"1#-715196743":[{m:"Rh5-f5",e:5}],"-1#-360175211":[{m:"Hf9-d8",e:5}],"1#728243751":[{m:"g4-g5",e:5}],"-1#-265692148":[{m:"Hh10-g8",e:5}],"1#854665025":[{m:"Ri1-h1",e:5}],"-1#946633841":[{m:"Ri10-h10",e:5}],"1#1647116672":[{m:"Rh1-h5",e:5}],"-1#-219771096":[{m:"Hb10-a8",e:5}],"1#-1200500950":[{m:"Hb1-c3",e:5}],"-1#-366369689":[{m:"Ra10-a9",e:5}],"1#-227525338":[{m:"Cb3-a3",e:5}],"-1#-1041353654":[{m:"Ra9-f9",e:5}],"1#116931780":[{m:"Ra1-b1",e:5}],"-1#810863672":[{m:"Cb8-c8",e:5}],"1#-1129675174":[{m:"i4-i5",e:5}],"-1#45456954":[{m:"g7-g6",e:5}],"1#1203729470":[{m:"Hh1-g3",e:5}],"-1#134404598":[{m:"Hh10-g8",e:5}],"1#-891673925":[{m:"Ri1-h1",e:5}],"-1#-1069057653":[{m:"Ri10-h10",e:5}],"1#-1710881670":[{m:"g4-g5",e:5}],"-1#-691146089":[{m:"c7-c6",e:5}],"1#363465132":[{m:"Cb3-e3",e:5}],"-1#-1075143114":[{m:"Ec10-e8",e:5}],"1#-1820811563":[{m:"Hb1-c3",e:5}],"-1#-1054804584":[{m:"Hb10-c8",e:5}],"1#-802101468":[{m:"Ra1-b1",e:5}],"-1#-425977896":[{m:"Ch8-h4",e:5}],"1#-1022022478":[{m:"Hg3-f5",e:5}],"-1#-1779990571":[{m:"Ch4xc4",e:5}],"1#1822311773":[{m:"Rh1xh10",e:5}],"-1#-1981001260":[{m:"Hg8xh10",e:5}],"1#-712414659":[{m:"Ce3xe7+",e:5}],"-1#1915180899":[{m:"Ad10-e9",e:5}],"1#-1629065326":[{m:"Ec1-e3",e:5}],"-1#738230715":[{m:"i7-i6",e:5}],"1#602754916":[{m:"i4-i5",e:5}],"-1#-1645062396":[{m:"i6xi5",e:5}],"1#-1079482353":[{m:"Rb1-b4",e:5}],"-1#-271705259":[{m:"Hh10-g8",e:5}],"1#756473880":[{m:"Ce7-e6",e:5}],"-1#-688775875":[{m:"Cc4-c5",e:5}],"1#-703218714":[{m:"Ee3xc5",e:5}],"-1#896989583":[{m:"Hb10-a8",e:9.923},{m:"c7-c6",e:9.923},{m:"Ch8-d8",e:9.923},{m:"Cb8-e8",e:9.923},{m:"Ra10-a9",e:9.923},{m:"Ch8-e8",e:9.923},{m:"Eg10-e8",e:9.923},{m:"Hb10-c8",e:9.923},{m:"g7-g6",e:9.923}],"1#2145499533":[{m:"a4-a5",e:8},{m:"Ch3-e3",e:8},{m:"Hb1-c3",e:8}],"-1#1368333505":[{m:"Ra10-b10",e:5}],"1#1778201176":[{m:"Hb1-a3",e:5}],"-1#1982041600":[{m:"Ch8-e8",e:5}],"1#357236539":[{m:"Hh1-g3",e:5}],"-1#1526158067":[{m:"Hh10-g8",e:5}],"1#-1741706818":[{m:"Ri1-h1",e:5}],"-1#-1833766258":[{m:"Ri10-h10",e:5}],"1#-923562113":[{m:"Ra1-b1",e:5}],"-1#-27295869":[{m:"Rh10-h6",e:5}],"1#1535690457":[{m:"Eg1-e3",e:5}],"-1#-586039285":[{m:"a7-a6",e:5}],"1#-650912503":[{m:"a5xa6",e:5}],"-1#1315908326":[{m:"Rh6xa6",e:5}],"1#-1533757149":[{m:"Rb1-b7",e:5}],"-1#-2076175744":[{m:"Cb8-c8",e:5}],"1#146692322":[{m:"Rb7xb10",e:5}],"-1#628502633":[{m:"Hh10-g8",e:5}],"1#-407975132":[{m:"Hb1-c3",e:5}],"-1#-1242128279":[{m:"Ra10-b10",e:5}],"1#-1920692496":[{m:"Hh1-g3",e:5}],"-1#-1036442824":[{m:"Ri10-h10",e:5}],"1#-1736941879":[{m:"Ri1-h1",e:5}],"-1#-1830484487":[{m:"g7-g6",e:5}],"1#-406850940":[{m:"Rh1-h7",e:5}],"-1#1565911289":[{m:"Cb8-d8",e:5}],"1#806386698":[{m:"a4-a5",e:5}],"-1#511629638":[{m:"Eg10-e8",e:5}],"1#-584849991":[{m:"a5-a6",e:5}],"-1#2085368997":[{m:"a7xa6",e:5}],"1#1874486613":[{m:"Ra1xa6",e:5}],"-1#896897881":[{m:"Ha8-b6",e:5}],"-1#767152832":[{m:"Ra10-b10",e:6.667},{m:"c7-c6",e:6.667}],"1#365689945":[{m:"Ra1-b1",e:5}],"-1#593956005":[{m:"Ch8-e8",e:5}],"1#1074691486":[{m:"Hh1-g3",e:5}],"-1#263442518":[{m:"Hh10-g8",e:5}],"1#-848614629":[{m:"Ri1-h1",e:9.375}],"-1#-940150741":[{m:"Ri10-i9",e:9.375},{m:"Ri10-h10",e:9.375}],"1#-287430149":[{m:"Ch3-e3",e:5}],"-1#-1270243297":[{m:"Ch8-e8",e:5}],"1#-685715164":[{m:"Hh1-g3",e:5}],"-1#-1734509332":[{m:"Hh10-g8",e:5}],"1#1514506145":[{m:"Ri1-h1",e:5}],"-1#1356389521":[{m:"Ri10-i9",e:5}],"1#-166657356":[{m:"Hh1-g3",e:9.75},{m:"g4-g5",e:9.75},{m:"Hb1-a3",e:9.75}],"-1#-1179865220":[{m:"Hb10-c8",e:8}],"1#-1464025664":[{m:"Hb1-c3",e:8},{m:"Hh1-g3",e:5}],"-1#-85666163":[{m:"Ra10-b10",e:6.667}],"1#-1030293484":[{m:"g4-g5",e:6.667},{m:"Ra1-b1",e:6.667}],"-1#-1906503943":[{m:"Ch8-e8",e:6.667}],"1#-315326526":[{m:"Ri1-h1",e:6.667},{m:"Ad1-e2",e:6.667}],"-1#-408345358":[{m:"Hh10-g8",e:5}],"-1#-197523224":[{m:"Hh10-i8",e:5}],"1#2084650772":[{m:"g4-g5",e:5}],"-1#814402041":[{m:"Ch8-h4",e:5}],"1#352580243":[{m:"Hg3-h5",e:5}],"-1#612410642":[{m:"Ch4xc4",e:5}],"-1#-461944019":[{m:"Hh10-g8",e:7.5},{m:"Ra10-b10",e:7.5}],"1#649048160":[{m:"Hb1-c3",e:5}],"-1#1962400557":[{m:"Ra10-b10",e:5}],"1#1283847604":[{m:"Ra1-b1",e:5}],"-1#2049508680":[{m:"Af10-e9",e:5}],"1#1988280794":[{m:"Rb1-b5",e:5}],"-1#774697953":[{m:"Cb8-a8",e:5}],"1#-603626060":[{m:"g4-g5",e:6.667},{m:"Ec1-e3",e:6.667}],"-1#1860406173":[{m:"Eg10-e8",e:5}],"1#-1380010142":[{m:"Hb1-c3",e:5}],"-1#-1647569":[{m:"Cb8-a8",e:5}],"1#920973295":[{m:"Ch3-i3",e:5}],"-1#-1160055719":[{m:"Hb10-c8",e:5}],"1#-1412765979":[{m:"Hh1-g3",e:5}],"-1#-372261140":[{m:"Cb8-f8",e:9.714},{m:"Cb8-b4",e:9.714},{m:"Hb10-c8",e:9.714},{m:"Cb8-e8",e:9.714}],"1#-616482532":[{m:"Ra1-b1",e:5}],"-1#-303183392":[{m:"Hb10-c8",e:5}],"1#-50472100":[{m:"g4-g5",e:5}],"1#1409480680":[{m:"Hh1-g3",e:6.667}],"-1#465525280":[{m:"Hb10-c8",e:6.667}],"1#179259548":[{m:"Ra1-a2",e:6.667}],"1#-119559088":[{m:"g4-g5",e:9.667},{m:"Hh1-g3",e:9.667}],"1#-597194428":[{m:"Hh1-g3",e:6.667}],"-1#-1814420340":[{m:"Hb10-c8",e:6.667}],"1#-2100677072":[{m:"Ra1-b1",e:6.667}],"1#579162178":[{m:"Hh1-g3",e:8.889},{m:"g4-g5",e:8.889},{m:"Hb1-c3",e:8.889}],"-1#1832451466":[{m:"Hh10-g8",e:8.333}],"1#-1344272697":[{m:"Hh1-g3",e:5},{m:"Ri1-h1",e:8.333},{m:"Hb1-c3",e:8.333}],"-1#-483659734":[{m:"Hb10-a8",e:6.667},{m:"Ri10-h10",e:6.667}],"1#-1447251928":[{m:"Hb1-c3",e:5}],"-1#-68887707":[{m:"Ra10-b10",e:6.667}],"1#-1013516804":[{m:"Ra1-b1",e:6.667},{m:"Hg3-h5",e:6.667}],"-1#-180747008":[{m:"Ri10-h10",e:5}],"1#-1350862607":[{m:"Ri1-h1",e:5}],"-1#-233463171":[{m:"Cb8-c8",e:5}],"1#2129389599":[{m:"Eg1-e3",e:5}],"-1#-126685491":[{m:"c7-c6",e:5}],"1#-1184199205":[{m:"Ri1-h1",e:5}],"-1#-1275603221":[{m:"Rh10-h6",e:5}],"1#371224497":[{m:"Ch3-i3",e:5}],"-1#1637589166":[{m:"Rh6-f6",e:5}],"1#2138145059":[{m:"Hb1-c3",e:5}],"-1#757721710":[{m:"Hb10-a8",e:5}],"-1#-1518510601":[{m:"Ri10-h10",e:7.5},{m:"Hb10-a8",e:7.5}],"1#-12836858":[{m:"Ch3-h7",e:6.667},{m:"Hb1-a3",e:6.667}],"1#-269869579":[{m:"g4-g5",e:5}],"-1#-1558058216":[{m:"Ra10-b10",e:5}],"-1#-38244982":[{m:"Hb10-a8",e:5}],"1#-1221644920":[{m:"c4-c5",e:5}],"-1#2017202432":[{m:"Ri10-h10",e:5}],"1#578645233":[{m:"Ri1-h1",e:5}],"-1#685782977":[{m:"g7-g6",e:5}],"1#1572520124":[{m:"Ra1-b1",e:5}],"-1#1850648239":[{m:"Hh10-g8",e:5}],"1#-1399431710":[{m:"Hh1-g3",e:5}],"-1#1893546767":[{m:"Hb10-a8",e:6.667}],"1#977959693":[{m:"g4-g5",e:6.667},{m:"Ra1-b1",e:6.667}],"-1#1988201952":[{m:"Hh10-g8",e:5}],"1#-1269205331":[{m:"Hb1-c3",e:5}],"-1#216435697":[{m:"Ra10-b10",e:5}],"1#882156904":[{m:"Hh1-g3",e:5}],"-1#2066286752":[{m:"Hh10-g8",e:5}],"1#-1175325715":[{m:"Ri1-h1",e:5}],"-1#-1284724515":[{m:"Ri10-h10",e:5}],"1#-382872276":[{m:"Ri1-h1",e:5}],"1#14601767":[{m:"Hh1-g3",e:8.75}],"1#758079694":[{m:"Hb1-a3",e:8},{m:"Hh1-g3",e:8},{m:"Hb1-c3",e:8}],"-1#854711446":[{m:"Ra9-d9",e:5}],"1#1566687541":[{m:"Eg1-e3",e:5}],"-1#-604452889":[{m:"Cb8-e8",e:5}],"1#-296685489":[{m:"Ra1-b1",e:5}],"-1#-654573389":[{m:"Hb10-c8",e:5}],"1#-907275761":[{m:"Rb1-b7",e:5}],"-1#-382158420":[{m:"Ce8xe4+",e:5}],"1#-1420435427":[{m:"Af1-e2",e:5}],"-1#-217314601":[{m:"Ch8-f8",e:5}],"1#806703358":[{m:"Rb7xc7",e:5}],"-1#1144680498":[{m:"Eg10-e8",e:5}],"1#-2023273267":[{m:"Hh1-f2",e:5}],"-1#-1322086820":[{m:"Ce4-e6",e:5}],"1#-151707673":[{m:"Hf2-e4",e:5}],"-1#1818281377":[{m:"Rd9-d4",e:5}],"-1#1653787910":[{m:"Ra9-d9",e:5}],"1#218288293":[{m:"Hh1-g3",e:6.667}],"-1#1599781864":[{m:"Hb10-a8",e:7.5},{m:"Rd9-d6",e:7.5},{m:"Eg10-e8",e:7.5}],"1#365820906":[{m:"Ra1-b1",e:5}],"-1#593562390":[{m:"Cb8-c8",e:5}],"1#-1348517516":[{m:"Ad1-e2",e:5}],"-1#-527019916":[{m:"Ch8-e8",e:5}],"1#-2080431793":[{m:"Ri1-h1",e:5}],"-1#-1990034817":[{m:"Hh10-g8",e:5}],"1#1270513970":[{m:"Ch3-i3",e:5}],"-1#1006718509":[{m:"c7-c6",e:5}],"1#-1735455442":[{m:"Ra1-b1",e:5}],"-1#-1373372974":[{m:"Eg10-e8",e:5}],"1#1837023533":[{m:"Af1-e2",e:5}],"-1#891759591":[{m:"Hb10-a8",e:5}],"1#2142268389":[{m:"Rb1-b5",e:5}],"-1#656300510":[{m:"Cb8-d8",e:5}],"1#1247530285":[{m:"g4-g5",e:5}],"-1#110115776":[{m:"Cd8xd3",e:5}],"1#-1677228265":[{m:"Ra1-b1",e:5}],"-1#-1431603221":[{m:"Hb10-a8",e:5}],"1#-532924439":[{m:"Af1-e2",e:5}],"-1#-1201283805":[{m:"a7-a6",e:5}],"1#-1136148447":[{m:"c4-c5",e:5}],"-1#1934949545":[{m:"Rd9-d6",e:5}],"1#-1266595217":[{m:"Rb1-b7",e:5}],"-1#-1806310964":[{m:"g7-g6",e:5}],"-1#2138508163":[{m:"Ra9-d9",e:6.667}],"1#283579936":[{m:"Hh1-g3",e:6.667}],"1#1444907188":[{m:"Hh1-g3",e:9.787},{m:"Ch3-e3",e:9.787}],"-1#430056828":[{m:"Hh10-g8",e:9.762},{m:"c7-c6",e:9.762},{m:"Hb10-a8",e:9.762}],"1#-612704719":[{m:"Ri1-h1",e:9.737},{m:"Hb1-c3",e:9.737}],"-1#-773356287":[{m:"Ri10-h10",e:9.167}],"1#-1951991568":[{m:"Hb1-c3",e:9.167}],"-1#-1994214020":[{m:"Hb10-c8",e:9.63},{m:"Hb10-a8",e:9.63}],"1#-624566713":[{m:"Hb1-c3",e:6.667}],"-1#-2002930422":[{m:"Cb8-c8",e:6.667}],"1#73662312":[{m:"Ra1-b1",e:6.667},{m:"Ec1-e3",e:6.667}],"-1#852430740":[{m:"Hb10-a8",e:5}],"-1#-1232793279":[{m:"Hh10-g8",e:5}],"1#1952311820":[{m:"Ra1-b1",e:5}],"1#1396008318":[{m:"Ri1-h1",e:6.667},{m:"Hb1-c3",e:6.667}],"-1#1504198222":[{m:"Hh10-g8",e:5}],"1#-1687108349":[{m:"Ch3-i3",e:5}],"-1#23924275":[{m:"c7-c6",e:5}],"1#-1039469304":[{m:"Ra1-b1",e:5}],"-1#-190446092":[{m:"Hb10-a8",e:5}],"-1#210239824":[{m:"Hb10-c8",e:8.333},{m:"Hh10-g8",e:8.333}],"1#496505836":[{m:"Hh1-g3",e:5}],"-1#1378205220":[{m:"Hb10-c8",e:8.333}],"1#-833553891":[{m:"Hh1-g3",e:8}],"1#-164903568":[{m:"Cb3-d3",e:5},{m:"Hb1-c3",e:7.5},{m:"c4-c5",e:7.5}],"-1#-1535922627":[{m:"Cb8-c8",e:5}],"1#680387679":[{m:"Ra1-b1",e:5}],"-1#505484451":[{m:"Hb10-a8",e:5}],"1#1421235361":[{m:"Ch3-e3",e:5}],"-1#237100357":[{m:"Hh10-g8",e:5}],"1#-856087032":[{m:"Hh1-g3",e:5}],"-1#-2092659776":[{m:"Ri10-h10",e:5}],"1#-653920719":[{m:"Ri1-h1",e:5}],"-1#-744968959":[{m:"Ch8-h4",e:5}],"1#-166619541":[{m:"Af1-e2",e:5}],"-1#-1370981215":[{m:"g7-g6",e:5}],"1#-619541540":[{m:"c4-c5",e:5}],"-1#335656788":[{m:"Ra10-b10",e:5}],"1#745773517":[{m:"Rb1xb10",e:5}],"-1#-1129741106":[{m:"Ha8xb10",e:5}],"1#1632342780":[{m:"Hc3-d5",e:5}],"-1#1258843329":[{m:"c7-c6",e:5}],"1#-2005952518":[{m:"Hd5xe7",e:5}],"-1#1604009457":[{m:"c6xc5",e:5}],"1#1692658789":[{m:"Ec1-a3",e:5}],"-1#-875939686":[{m:"c5-c4",e:5}],"1#-472796651":[{m:"He7xg6",e:5}],"-1#-1439733407":[{m:"Ch4-h6",e:5}],"1#-1447944584":[{m:"Cd3-d8",e:5}],"1#610724659":[{m:"Hb1-c3",e:9.286},{m:"Hb1-a3",e:9.286},{m:"c4-c5",e:9.286}],"-1#1983807614":[{m:"Ra10-b10",e:6.667}],"1#1313648359":[{m:"c4-c5",e:6.667},{m:"Ra1-b1",e:6.667}],"-1#-2124443025":[{m:"Cb8-a8",e:8.75},{m:"g7-g6",e:8.75}],"1#1214095791":[{m:"Hh1-g3",e:8.333}],"-1#132123751":[{m:"g7-g6",e:8.333},{m:"Hh10-g8",e:8.333}],"-1#2027970075":[{m:"Ch8-f8",e:5}],"1#-1141308366":[{m:"Rb1-b7",e:5}],"-1#-1691504751":[{m:"Ri10-i9",e:5}],"1#-628655115":[{m:"c4-c5",e:5}],"-1#362039165":[{m:"Ri9-d9",e:5}],"1#-359600446":[{m:"Af1-e2",e:5}],"-1#-1295449080":[{m:"Rd9-d4",e:5}],"1#-1546340403":[{m:"Ch3-e3",e:5}],"-1#-113033687":[{m:"Hh10-g8",e:5}],"-1#1001936747":[{m:"Ra10-b10",e:7.5}],"1#63601138":[{m:"Ra1-b1",e:7.5},{m:"Eg1-e3",e:7.5}],"-1#895912206":[{m:"Ch8-e8",e:6.667},{m:"Hh10-g8",e:6.667}],"1#1443887157":[{m:"Hh1-g3",e:5}],"-1#431117821":[{m:"Cb8-b3",e:5}],"1#-138513853":[{m:"Ch3-e3",e:5}],"-1#-1389757529":[{m:"Ri10-h10",e:5}],"-1#-2058125536":[{m:"c7-c6",e:5}],"1#1177846811":[{m:"Hh1-g3",e:5}],"-1#159984083":[{m:"Hh10-g8",e:6.667}],"1#-883830114":[{m:"Ra1-a2",e:6.667}],"-1#1108367925":[{m:"Ec10-e8",e:6.667},{m:"Cb8-a8",e:6.667}],"-1#-344598597":[{m:"Ra10-b10",e:8.889},{m:"g7-g6",e:8.889},{m:"Hh10-i8",e:8.889}],"1#-754452190":[{m:"c4-c5",e:6.667}],"1#1661919303":[{m:"Hb1-c3",e:5}],"-1#827755274":[{m:"i7-i6",e:5}],"1#1052460501":[{m:"Ra1-b1",e:5}],"-1#135771433":[{m:"Hi8-h6",e:5}],"1#1076629234":[{m:"Hb1-a3",e:8.333},{m:"c4-c5",e:8.333},{m:"Hb1-c3",e:8.333}],"-1#309618111":[{m:"Hh10-g8",e:7.5},{m:"Hb10-c8",e:7.5}],"1#-793993486":[{m:"Ra1-b1",e:5}],"-1#-436179442":[{m:"Cb8-d8",e:5}],"1#-1958348035":[{m:"Rb1-b5",e:5}],"-1#-739522362":[{m:"Hb10-a8",e:5}],"1#-1719891772":[{m:"g4-g5",e:5}],"-1#-709394903":[{m:"g6xg5",e:5}],"1#1332983326":[{m:"Rb5xg5",e:5}],"1#56915715":[{m:"Ra1-b1",e:6.667},{m:"c4-c5",e:6.667}],"-1#902334463":[{m:"Ra10-b10",e:5}],"1#230336870":[{m:"Ra1-b1",e:8.333}],"-1#566760248":[{m:"g7-g6",e:8.571},{m:"Cb8-e8",e:8.571}],"1#1418912837":[{m:"Hh1-g3",e:8.333},{m:"c4-c5",e:8.333},{m:"Hb1-a3",e:8.333},{m:"Ch3-g3",e:8.333},{m:"Eg1-e3",e:8.333}],"-1#-1685989171":[{m:"Hh10-g8",e:5}],"1#1499014016":[{m:"Ch3-e3",e:5}],"-1#63875684":[{m:"Ri10-h10",e:5}],"1#1502599061":[{m:"Hb1-c3",e:5}],"-1#198687960":[{m:"Ch8-i8",e:5}],"1#909565483":[{m:"Hh1-g3",e:5}],"-1#2039182307":[{m:"Ec10-e8",e:5}],"1#1427731200":[{m:"Hc3-d5",e:5}],"-1#2136640829":[{m:"Hb10-d9",e:5}],"1#1970860583":[{m:"Ri1-h1",e:5}],"-1#2145757463":[{m:"Rh10xh1",e:5}],"1#1201154985":[{m:"Hg3xh1",e:5}],"-1#1268240626":[{m:"Cb8-b5",e:5}],"1#93754231":[{m:"Cb3-d3",e:5}],"-1#1061608588":[{m:"Cb5xd5",e:5}],"1#-1535257226":[{m:"Cd3xd9",e:5}],"-1#-1590999764":[{m:"Ad10-e9",e:5}],"1#1307213277":[{m:"Ra1-b1",e:5}],"-1#2068221217":[{m:"Cd5xa5",e:5}],"1#-686202394":[{m:"Hh1-g3",e:5}],"-1#-1734030290":[{m:"Ra10-d10",e:5}],"1#1586154820":[{m:"Rb1-b9",e:5}],"-1#2079456577":[{m:"a7-a6",e:5}],"1#2144591939":[{m:"Ce3-d3",e:5}],"-1#-1143256306":[{m:"Rd10-c10",e:5}],"1#903572984":[{m:"Rb9-b6",e:5}],"-1#1729615473":[{m:"Ca5-a4",e:5}],"1#-2038400443":[{m:"Rb6-b4",e:5}],"-1#-1588493677":[{m:"Ca4-a2",e:5}],"1#1279453487":[{m:"Af1-e2",e:5}],"-1#337314789":[{m:"Hg8-f6",e:5}],"1#-1234512042":[{m:"Rb4-a4",e:5}],"-1#1193904765":[{m:"Ca2-c2",e:5}],"1#-2010196046":[{m:"Ra4xa6",e:5}],"-1#1488308290":[{m:"Hf6xg4",e:5}],"1#-1173633229":[{m:"Cd3-e3",e:5}],"-1#2114153598":[{m:"Hg4xe3",e:5}],"1#-1723429565":[{m:"Eg1xe3",e:5}],"-1#-1145083408":[{m:"c7-c6",e:5}],"1#2027459275":[{m:"c5xc6",e:5}],"-1#1196157215":[{m:"Rc10xc6",e:5}],"1#-1296726309":[{m:"Ra6xc6",e:5}],"-1#-1942838759":[{m:"Ee8xc6",e:5}],"1#-1304822429":[{m:"Hg3-f5",e:5}],"-1#1263294493":[{m:"Hb10-c8",e:5}],"1#1515997857":[{m:"Hh1-g3",e:5}],"-1#1248655459":[{m:"Cb8-e8",e:5}],"1#2143604683":[{m:"Ec1-e3",e:5}],"-1#-853401118":[{m:"Hh10-i8",e:5}],"1#1163466270":[{m:"Hh1-i3",e:5}],"-1#1557599776":[{m:"Ri10-h10",e:5}],"1#110521297":[{m:"Ri1-h1",e:5}],"-1#202060001":[{m:"Ch8-h4",e:5}],"1#696388491":[{m:"Hb1-a3",e:5}],"-1#912046035":[{m:"Hb10-c8",e:5}],"1#659334511":[{m:"Ha3-b5",e:5}],"-1#602446870":[{m:"c7-c6",e:5}],"1#-527472851":[{m:"Ad1-e2",e:5}],"-1#-1350142419":[{m:"Af10-e9",e:5}],"1#-1557286209":[{m:"i4-i5",e:5}],"-1#489859807":[{m:"Ce8xe4",e:5}],"1#1600123758":[{m:"Cg3xg6",e:5}],"-1#1007417626":[{m:"Ce4-e5",e:5}],"1#-1464944187":[{m:"Cg6-g5",e:5}],"-1#-225825685":[{m:"Eg10-e8",e:5}],"1#836178068":[{m:"Cg5-h5",e:5}],"-1#1929018655":[{m:"Ch4xc4",e:5}],"1#-1954330729":[{m:"Ra1-c1",e:5}],"-1#801124827":[{m:"Cc4-f4",e:5}],"1#-324983415":[{m:"Rc1-c4",e:5}],"-1#1978409211":[{m:"Cf4-f8",e:5}],"1#-752506849":[{m:"Rc4-e4",e:5}],"-1#-1477111280":[{m:"Ce5xi5",e:5}],"1#31842891":[{m:"Ch5-h8",e:5}],"-1#1706246884":[{m:"c6-c5",e:5}],"1#-342267771":[{m:"Hb5-c7",e:5}],"-1#-1765979982":[{m:"Ra10-b10",e:5}],"1#-1362139605":[{m:"Cb3-c3",e:5}],"-1#-1540930254":[{m:"Ci5xa5",e:5}],"1#936695767":[{m:"Re4-a4",e:5}],"-1#-195102950":[{m:"Ca5-a6",e:5}],"1#1459564572":[{m:"Hc7xa6",e:5}],"-1#40079276":[{m:"Hc8-b6",e:5}],"1#-600418083":[{m:"Ra4-b4",e:5}],"-1#762643958":[{m:"c5-c4",e:5}],"1#91131769":[{m:"Rb4-b5",e:5}],"-1#276560233":[{m:"c4xc3",e:5}],"1#224235405":[{m:"Ha6-b4",e:5}],"-1#-1817237315":[{m:"Hb6-c8",e:5}],"1#1308295116":[{m:"Rb5xb10",e:5}],"-1#-770973033":[{m:"Hh10-g8",e:5}],"1#282270170":[{m:"Hb1-a3",e:5}],"-1#252552578":[{m:"Hb10-a8",e:5}],"1#1167779200":[{m:"Ra1-a2",e:5}],"-1#-858034901":[{m:"Eg10-e8",e:5}],"1#260461012":[{m:"Ra2-f2",e:6.667},{m:"Ra2-g2",e:6.667}],"-1#-1113270024":[{m:"Ra10-a9",e:8}],"1#-1510129223":[{m:"Rf2-f5",e:8.571},{m:"Rf2-f7",e:8.571},{m:"Af1-e2",e:8.571},{m:"Ha3-b5",e:8.571}],"-1#2089258914":[{m:"Af10-e9",e:5}],"1#1881951024":[{m:"Hh1-g3",e:5}],"-1#1066526456":[{m:"Ra9-d9",e:5}],"-1#1212958290":[{m:"Ch8-h10",e:6.667}],"1#1955764682":[{m:"Ha3-b5",e:6.667}],"-1#1882628275":[{m:"Cb8-d8",e:6.667}],"-1#-39539853":[{m:"Ch8-i8",e:5}],"1#-1069168256":[{m:"Ha3-b5",e:5}],"-1#-991825671":[{m:"Cb8-d8",e:5}],"-1#-1587971904":[{m:"Cb8-d8",e:6.667}],"1#-870519757":[{m:"Hh1-g3",e:6.667},{m:"Rf2-f5",e:6.667}],"-1#-2086583813":[{m:"Ch8-h6",e:5}],"-1#-822979642":[{m:"Ra10-a9",e:6.667}],"1#-693384569":[{m:"g4-g5",e:6.667}],"-1#-1704969110":[{m:"g6xg5",e:6.667}],"1#10810461":[{m:"Rg2xg5",e:6.667}],"-1#688488167":[{m:"Ch8-h10",e:8.333},{m:"Ra9-f9",e:8.333}],"1#366453119":[{m:"Ha3-b5",e:8},{m:"Hh1-g3",e:8}],"-1#292788230":[{m:"Ch10-g10",e:6.667}],"1#-1935091279":[{m:"Rg5-h5",e:6.667}],"-1#1516899511":[{m:"Ch10-g10",e:6.667}],"1#-944681728":[{m:"Rg5-f5",e:6.667}],"1#-299927959":[{m:"Ha3-b5",e:6.667}],"-1#-356823280":[{m:"Cb8-d8",e:6.667}],"1#-2013340701":[{m:"Hh1-g3",e:6.667}],"-1#-935102933":[{m:"Ch8-h10",e:6.667},{m:"Af10-e9",e:6.667}],"1#-190993997":[{m:"Rg5-d5",e:5}],"1#-991382855":[{m:"Af1-e2",e:5}],"1#341845136":[{m:"Ch3-e3",e:5}],"-1#1324854644":[{m:"Hh10-g8",e:5}],"1#-1943054791":[{m:"Hh1-g3",e:5}],"-1#-1013777423":[{m:"Ri10-h10",e:5}],"1#-1714190848":[{m:"Ri1-h1",e:5}],"-1#-1823548112":[{m:"Ch8-h4",e:5}],"1#-1228413350":[{m:"Hb1-c3",e:5}],"-1#-459305705":[{m:"Hb10-c8",e:5}],"1#-175136853":[{m:"Ra1-b1",e:5}],"-1#-1021087913":[{m:"Ra10-b10",e:5}],"1#-78560818":[{m:"Cb3-b7",e:5}],"-1#-404895436":[{m:"c7-c6",e:5}],"1#616182287":[{m:"Af1-e2",e:5}],"-1#2095306949":[{m:"g7-g6",e:5}],"1#163131320":[{m:"Cb7-c7",e:5}],"-1#1749595067":[{m:"Ec10-a8",e:5}],"1#-1019000326":[{m:"Rb1xb10",e:5}],"-1#1402557689":[{m:"Hc8xb10",e:5}],"1#-704901003":[{m:"Cc7-d7",e:5}],"-1#620324301":[{m:"Ad10-e9",e:5}],"1#-935830212":[{m:"Rh1-h2",e:5}],"-1#-920786370":[{m:"g6-g5",e:5}],"1#-1332999031":[{m:"Hg3-i2",e:5}],"-1#-1976569850":[{m:"Ch4-h3",e:5}],"1#1519928180":[{m:"Ae2-f3",e:5}],"-1#88424941":[{m:"Ch3xe3",e:5}],"1#-1063315601":[{m:"Rh2xh10",e:5}],"-1#957711253":[{m:"Hg8xh10",e:5}],"1#1701886076":[{m:"Eg1xe3",e:5}],"-1#1052669238":[{m:"g5xg4",e:5}],"1#359308219":[{m:"Cd7-d4",e:5}],"-1#-950762368":[{m:"Hh10-g8",e:5}],"1#93093837":[{m:"Cd4xg4",e:5}],"-1#665087455":[{m:"Hg8-f6",e:5}],"1#-2049590932":[{m:"Cg4-g3",e:5}],"-1#71453032":[{m:"Hb10-c8",e:5}],"1#357718996":[{m:"Hi2-h4",e:5}],"-1#-1407686420":[{m:"Hc8-d6",e:5}],"1#-2035629201":[{m:"Af3-e2",e:5}],"-1#-646462986":[{m:"Hd6xc4",e:5}],"1#1705871101":[{m:"Hh4-f5",e:5}],"-1#-1330243027":[{m:"Ce8-c8",e:5}],"1#339562646":[{m:"Hc3-a2",e:5}],"-1#1286153318":[{m:"Hc4xa5",e:5}],"1#-2143916340":[{m:"Hf5-d6",e:5}],"-1#1851668834":[{m:"Cc8-c7",e:5}],"1#1906482493":[{m:"Ee3-g5",e:5}],"-1#1043671512":[{m:"Eg10-e8",e:5}],"1#-43510489":[{m:"Cg3-e3",e:5}],"-1#231508960":[{m:"Ha5-c4",e:5}],"1#1536844329":[{m:"Hd6xc4",e:5}],"-1#-2013233331":[{m:"Cc7xc4",e:5}],"1#-1842769358":[{m:"e4-e5",e:5}],"-1#363231102":[{m:"Hf6-e4",e:5}],"1#-444217961":[{m:"Ec1-a3",e:5}],"-1#1252790632":[{m:"Cc4-a4",e:5}],"1#1069644527":[{m:"Ha2-c1",e:5}],"-1#522638823":[{m:"Ca4xi4",e:5}],"1#133286240":[{m:"Hc1-b3",e:5}],"-1#-1286098278":[{m:"Ci4-i3",e:5}],"1#1901800141":[{m:"Hb3-d2",e:5}],"-1#1032974471":[{m:"Ci3xa3",e:5}],"1#-994263389":[{m:"Ae2-f3",e:5}],"-1#-1688093638":[],"-1#1085253492":[{m:"Hb10-c8",e:8},{m:"Ec10-e8",e:8},{m:"c7-c6",e:8}],"1#1371518408":[{m:"c4-c5",e:5}],"-1#-1632859840":[{m:"g7-g6",e:5}],"1#-336167363":[{m:"Hb1-c3",e:5}],"-1#-1179773584":[{m:"Hh10-g8",e:5}],"1#2071391805":[{m:"Hh1-i3",e:5}],"-1#1660481027":[{m:"Ec10-e8",e:5}],"1#1315630816":[{m:"Ec1-e3",e:5}],"-1#-57933623":[{m:"i7-i6",e:6.667},{m:"Cb8-a8",e:6.667}],"1#-211694058":[{m:"Ch3-f3",e:5}],"-1#-700606289":[{m:"Hg8-h6",e:5}],"1#1274310688":[{m:"Ra1-d1",e:5}],"-1#569714065":[{m:"Ad10-e9",e:5}],"1#-852222624":[{m:"Cb3-b6",e:5}],"-1#1542353676":[{m:"c7-c6",e:5}],"1#-1735817161":[{m:"c5xc6",e:5}],"-1#-1491405853":[{m:"Hc8xb6",e:5}],"1#-1567517872":[{m:"c6xb6",e:5}],"-1#521868549":[{m:"Ra10-c10",e:5}],"1#1256719848":[{m:"Rd1-d7",e:5}],"-1#-38890206":[{m:"Ri10-i7",e:5}],"1#945942524":[{m:"Hc3-d5",e:5}],"-1#304222657":[{m:"Rc10-c4",e:5}],"1#-1663436338":[{m:"b6-b7",e:5}],"-1#-1241420429":[{m:"Cb8-d8",e:5}],"1#-616236672":[{m:"Hd5-c7",e:5}],"-1#-989738522":[{m:"Rc4xe4",e:5}],"1#1667509359":[{m:"b7xa7",e:5}],"-1#1722251263":[{m:"g6-g5",e:5}],"1#523669832":[{m:"Rd7-d6",e:5}],"-1#536255855":[{m:"Hh6-f5",e:5}],"1#-1608057983":[{m:"Rd6-d5",e:5}],"-1#611844393":[{m:"Re4xa4",e:5}],"1#1339030832":[{m:"g4xg5",e:5}],"-1#542353420":[{m:"Hf5-d4",e:5}],"1#-1205490434":[{m:"Cf3-f2",e:5}],"-1#1571686144":[{m:"Ri7-f7",e:5}],"1#1537007114":[{m:"Cf2-g2",e:5}],"-1#-2019483934":[{m:"Rf7-f2",e:5}],"1#-517782381":[{m:"Rd5-c5",e:5}],"-1#1564799244":[{m:"Ra4-a1+",e:5}],"1#-1375146942":[{m:"Ee3-c1",e:5}],"-1#485360235":[{m:"Cd8-c8",e:5}],"1#-527897717":[{m:"Hc7-a8",e:5}],"-1#562815259":[{m:"Cc8xc1",e:5}],"1#1949063269":[{m:"Rc5-c10+",e:5}],"-1#-154483413":[{m:"Ae9-d10",e:5}],"1#436993498":[{m:"Ha8-c9+",e:5}],"-1#2007063362":[{m:"Ke10-e9",e:5}],"1#1445814503":[{m:"Hc9-d7+",e:5}],"-1#771136080":[{m:"Ke9-f9",e:5}],"1#1248670144":[{m:"Rc10-c9+",e:5}],"-1#101512258":[{m:"Af10-e9",e:5}],"1#178729168":[{m:"Ke1-d1",e:5}],"-1#838115488":[{m:"Cc1xf1+",e:5}],"1#1761263482":[{m:"Kd1-d2",e:5}],"-1#2050206609":[{m:"Rf2xe2+",e:5}],"1#1053671834":[{m:"Kd2-d3",e:5}],"-1#-357978643":[{m:"Ra1-d1+",e:5}],"1#-231912478":[],"1#898511625":[{m:"Hc3-b5",e:5}],"-1#2091703653":[{m:"Hg8-f6",e:5}],"1#-555939370":[{m:"Ch3-h6",e:5}],"-1#-1198722310":[{m:"Hf6-g8",e:5}],"1#452798025":[{m:"Ch6-h7",e:5}],"-1#356742318":[{m:"c7-c6",e:5}],"1#-702247019":[{m:"c5xc6",e:5}],"-1#-373820351":[{m:"Ee8xc6",e:5}],"1#828801544":[{m:"Ri1-i2",e:5}],"-1#1680002656":[{m:"Eg10-e8",e:5}],"1#-1484787041":[{m:"Ri2-f2",e:5}],"-1#-1414907675":[{m:"Af10-e9",e:5}],"1#-1493042057":[{m:"Ra1-d1",e:5}],"-1#-855594554":[{m:"Ri10-f10",e:5}],"1#1154752002":[{m:"Rf2xf10+",e:5}],"-1#2092356150":[{m:"Ae9xf10",e:5}],"1#-1359728933":[{m:"Rd1-d4",e:5}],"-1#521245636":[{m:"Af10-e9",e:5}],"1#330979158":[{m:"Ch7-h5",e:5}],"-1#168472734":[{m:"Hg8-f6",e:5}],"1#-1468308435":[{m:"Ch5-c5",e:5}],"-1#-896107762":[{m:"i7-i6",e:5}],"1#-981748271":[{m:"e4-e5",e:5}],"-1#1123307677":[{m:"Ca8-b8",e:5}],"1#-1946786979":[{m:"Cb3-a3",e:5}],"-1#-1201116623":[{m:"Hc8-b6",e:5}],"1#1715322176":[{m:"Hb5-c3",e:5}],"-1#790582060":[{m:"Cb8-c8",e:5}],"1#-1545529010":[{m:"Rd4-b4",e:5}],"-1#51529015":[{m:"Hf6-d7",e:5}],"1#1878269044":[{m:"Cc5xc8",e:5}],"-1#510666937":[{m:"Hb6xc8",e:5}],"1#264693876":[{m:"Rb4-e4",e:5}],"-1#550675171":[],"1#1815979927":[{m:"Hh1-i3",e:5}],"-1#1974708137":[{m:"c7-c6",e:5}],"1#-1227596654":[{m:"Ch3-f3",e:5}],"-1#-1819801045":[{m:"Hh10-g8",e:5}],"1#1364259174":[{m:"Ri1-h1",e:5}],"-1#1540205142":[{m:"Ri10-h10",e:5}],"1#26007463":[{m:"Rh1-h5",e:5}],"-1#-1857595121":[{m:"Ch8-i8",e:5}],"1#-1398391812":[{m:"Rh5-d5",e:5}],"-1#-1215046051":[{m:"Hb10-c8",e:5}],"1#-1501311775":[{m:"Hb1-c3",e:5}],"-1#-186931284":[{m:"Rh10-h6",e:5}],"1#1359748854":[{m:"Ec1-e3",e:5}],"-1#-471142177":[{m:"Ad10-e9",e:5}],"1#254527534":[{m:"c4-c5",e:5}],"-1#-1070009178":[{m:"Ra10-d10",e:5}],"1#102168012":[{m:"Ra1-d1",e:5}],"-1#1813487741":[{m:"c6xc5",e:5}],"1#1466921449":[{m:"Rd5xc5",e:5}],"-1#40708773":[{m:"Rd10xd1+",e:5}],"1#1824539473":[{m:"Ae2xd1",e:5}],"-1#-398788056":[{m:"Hc8-d6",e:5}],"1#-1031253589":[{m:"Cb3-a3",e:5}],"-1#-250193721":[{m:"Ci8xi4",e:5}],"1#-1251138472":[{m:"Ca3xa7",e:5}],"-1#-531104697":[{m:"Hd6xe4",e:5}],"1#-489104278":[{m:"Rc5-b5",e:5}],"-1#-1194695690":[{m:"Rh6-a6",e:5}],"1#1172683969":[{m:"Ca7xg7",e:5}],"-1#-916050747":[{m:"Cb8-d8",e:5}],"1#-1541162954":[{m:"a4-a5",e:5}],"-1#-1974657670":[{m:"Ra6-g6",e:5}],"1#-118543159":[{m:"g4-g5",e:5}],"-1#-1272653276":[{m:"Rg6xg7",e:5}],"1#329390087":[{m:"Hc3xe4",e:5}],"-1#-448510749":[{m:"e7-e6",e:5}],"1#1201025428":[{m:"g5-g6",e:5}],"-1#630898311":[{m:"Rg7xg6",e:5}],"1#1432690146":[{m:"He4-g5",e:5}],"-1#-1104411417":[{m:"Hg8-h6",e:5}],"1#602270824":[{m:"Ad1-e2",e:5}],"-1#1827470696":[{m:"Rg6-g7",e:5}],"1#572783643":[{m:"Hg5xe6",e:5}],"-1#1214885030":[{m:"Rg7-e7",e:5}],"1#66157011":[{m:"He6-g5",e:5}],"-1#761649123":[{m:"Ci4-i5",e:5}],"1#-870413737":[],"1#-2084021169":[{m:"Cb3-c3",e:6.667},{m:"Ch3-d3",e:6.667}],"-1#-1994358954":[{m:"Ec10-e8",e:5}],"1#-1515028555":[{m:"Ch3-e3",e:5}],"-1#-14289327":[{m:"Hh10-g8",e:5}],"1#1039994140":[{m:"Hb1-a3",e:5}],"-1#572764484":[{m:"Ri10-h10",e:5}],"1#2019740853":[{m:"Hh1-g3",e:5}],"-1#937386365":[{m:"Hb10-d9",e:5}],"1#1039998567":[{m:"Ra1-b1",e:5}],"-1#189918875":[{m:"Ra10-b10",e:5}],"1#857980930":[{m:"Rb1-b5",e:5}],"-1#1804464697":[{m:"Cb8-d8",e:5}],"1#113796810":[{m:"Rb5-d5",e:5}],"-1#751739016":[{m:"Ad10-e9",e:5}],"1#-1072719751":[{m:"g4-g5",e:5}],"-1#-1933283692":[{m:"Rb10-b7",e:5}],"1#2002126410":[{m:"Ri1-h1",e:5}],"-1#2110479738":[{m:"Ch8-h4",e:5}],"1#1480746512":[{m:"a4-a5",e:5}],"-1#1982645084":[{m:"Hd9-b8",e:5}],"1#-570289177":[{m:"Ce3-f3",e:5}],"-1#-1139475509":[{m:"Ch4-g4",e:5}],"1#-1391557017":[{m:"Eg1-e3",e:5}],"-1#731349173":[{m:"Rh10xh1",e:5}],"1#334103051":[{m:"Hg3xh1",e:5}],"-1#535165264":[{m:"e7-e6",e:5}],"1#-1120433113":[{m:"Cf3-g3",e:5}],"-1#-1689718327":[{m:"Cg4-h4",e:5}],"1#-1974301595":[{m:"Rd5-f5",e:5}],"-1#831680525":[{m:"Rb7-e7",e:5}],"1#182009203":[{m:"Hh1-f2",e:5}],"-1#1015873506":[{m:"i7-i6",e:5}],"1#862007613":[{m:"Cc3-d3",e:5}],"-1#511994542":[{m:"Ch4-h8",e:5}],"1#990728644":[{m:"Rf5-b5",e:5}],"-1#-1223271265":[{m:"Hb8-c10",e:5}],"1#1782970971":[{m:"Cd3-d6",e:5}],"-1#-116062171":[{m:"Ch8-i8",e:5}],"1#-990614826":[{m:"Cd6xi6",e:5}],"-1#1417649551":[{m:"Ci8xi4",e:5}],"1#268755216":[{m:"Hf2-h3",e:5}],"-1#540714923":[{m:"Hg8-i7",e:5}],"1#-1015407140":[{m:"Ee3-g1",e:5}],"-1#1172511502":[{m:"g7-g6",e:5}],"1#817491059":[{m:"Cg3-e3",e:5}],"-1#1762479808":[{m:"Re7-h7",e:5}],"1#-327070574":[{m:"Ci6xe6",e:5}],"-1#1583738136":[{m:"Rh7xh3",e:5}],"1#-294608487":[{m:"Rb5-b10",e:5}],"-1#2090520430":[{m:"Ke10-d10",e:5}],"1#90991127":[{m:"Ce3-d3+",e:5}],"-1#-1050361510":[{m:"Cd8-c8",e:5}],"1#1023551674":[{m:"Ha3-b5",e:5}],"-1#967184835":[{m:"Cc8xc4",e:5}],"1#238134240":[{m:"Ec1-e3",e:5}],"-1#-1126740535":[{m:"Rh3-h7",e:5}],"1#-1983317640":[{m:"Hb5-d6+",e:5}],"-1#95117409":[{m:"Kd10-e10",e:5}],"1#2086520088":[{m:"Hd6-c8",e:5}],"-1#1204165704":[],"-1#9062807":[{m:"Hh10-g8",e:5}],"1#-1034767654":[{m:"Hh1-g3",e:5}],"-1#-1913708782":[{m:"Ri10-h10",e:5}],"1#-676437277":[{m:"Ri1-i2",e:5}],"-1#-2098581877":[{m:"Ch8-h2",e:5}],"1#1970264380":[{m:"i4-i5",e:5}],"-1#-881802916":[{m:"Hb10-c8",e:5}],"1#-631188512":[{m:"i5-i6",e:5}],"-1#-730265843":[{m:"i7xi6",e:5}],"1#-1785276546":[{m:"Ri2xi6",e:5}],"-1#1958227947":[{m:"Ec10-e8",e:5}],"1#1479159560":[{m:"Ri6-i5",e:5}],"-1#-387025151":[{m:"Ch2-h5",e:5}],"1#-635409144":[{m:"Hb1-a3",e:5}],"-1#-973156016":[{m:"g7-g6",e:5}],"1#-1331419603":[{m:"Ec1-e3",e:5}],"-1#37931012":[{m:"Cb8-a8",e:5}],"1#-884933692":[{m:"Cb3-c3",e:5}],"-1#-1045899043":[{m:"Ra10-b10",e:5}],"1#-103090620":[{m:"c4-c5",e:5}],"-1#919194316":[{m:"Ca8xa4",e:5}],"1#-487285527":[{m:"Ra1-c1",e:5}],"-1#1186458277":[{m:"Hc8-d6",e:5}],"1#1812283686":[{m:"c5xc6",e:5}],"-1#1402354418":[{m:"Ee8xc6",e:5}],"1#-1958261573":[{m:"g4-g5",e:5}],"-1#-947078570":[{m:"g6xg5",e:5}],"1#1565028961":[{m:"Ee3xg5",e:5}],"-1#417130017":[{m:"Ch5-h6",e:5}],"1#-430018403":[{m:"Eg5-e3",e:5}],"-1#-2137176308":[{m:"Rb10-b4",e:5}],"1#2109390573":[{m:"Rc1-b1",e:5}],"-1#-225964244":[{m:"Rb4xb1+",e:5}],"1#-564217235":[{m:"Ha3xb1",e:5}],"-1#167982807":[{m:"Ca4-a6",e:5}],"1#1424517780":[{m:"Hb1-a3",e:5}],"-1#1261885132":[{m:"Eg10-e8",e:5}],"1#-2006193613":[{m:"Ha3-b5",e:5}],"-1#-1932537014":[{m:"Rh10-h9",e:5}],"1#-1980948416":[{m:"Hb5xd6",e:5}],"-1#751488302":[{m:"Ca6xd6",e:5}],"1#202135280":[{m:"Hg3-f5",e:5}],"-1#1526597015":[{m:"Cd6-d8",e:5}],"1#-1183694545":[{m:"Ri5-h5",e:5}],"-1#-121785981":[{m:"Rh9-h10",e:5}],"1#-39894391":[{m:"Ee3-c1",e:5}],"-1#1333374112":[{m:"Ch6-h9",e:5}],"1#824083152":[{m:"Cd3-e3",e:5}],"-1#-183096931":[{m:"Ch9-g9",e:5}],"1#-1780786094":[],"-1#850235794":[{m:"Hh10-i8",e:9.783},{m:"Cb8-d8",e:9.783},{m:"Ri10-i9",e:9.783},{m:"Cb8-g8",e:9.783},{m:"Ec10-e8",e:9.783},{m:"g7-g6",e:9.783},{m:"Hb10-a8",e:9.783},{m:"Cb8-e8",e:9.783},{m:"Ch8-e8",e:9.783},{m:"Hh10-g8",e:9.783}],"1#-1160337810":[{m:"Hh1-g3",e:6.667}],"-1#-177534042":[{m:"Ri10-h10",e:6.667},{m:"Hh10-i8",e:9}],"1#-1356171689":[{m:"Ri1-h1",e:5}],"-1#-1514721945":[{m:"Ec10-e8",e:5}],"1#-1994052220":[{m:"Ec1-e3",e:7.5},{m:"Hb1-a3",e:7.5}],"-1#1002685357":[{m:"c7-c6",e:6.667}],"1#-123455338":[{m:"Hb1-d2",e:6.667}],"-1#719530387":[{
m:"Hb10-c8",e:6.667}],"1#1005796143":[{m:"c4-c5",e:6.667}],"-1#-186644569":[{m:"c6xc5",e:6.667}],"1#-812067277":[{m:"Rh1-h5",e:6.667}],"-1#1599297691":[{m:"Hc8-b6",e:6.667}],"1#-2130276374":[{m:"Rh5xc5",e:6.667}],"-1#-756283786":[{m:"Ch8-f8",e:6.667},{m:"Ad10-e9",e:6.667}],"1#301292639":[{m:"g4-g5",e:5}],"-1#1564388018":[{m:"Rh10-h6",e:5}],"1#1043152519":[{m:"Ra1-b1",e:5}],"-1#142724731":[{m:"Hb6xa4",e:5}],"1#-1884427873":[{m:"Cb3-a3",e:5}],"-1#-1761898020":[{m:"i7-i6",e:5}],"1#-1726587133":[{m:"Rh1-h5",e:5}],"-1#165532075":[{m:"Ch8-g8",e:5}],"1#2133262177":[{m:"Rh5xh10",e:5}],"-1#390222385":[{m:"Hi8xh10",e:5}],"1#25470313":[{m:"g4-g5",e:5}],"-1#1297044356":[{m:"Hb10-d9",e:5}],"1#1198337182":[{m:"Ra1-a2",e:5}],"-1#-835935179":[{m:"Hh10-i8",e:5}],"1#1180144585":[{m:"Ra2-f2",e:5}],"-1#-193651995":[{m:"a7-a6",e:5}],"1#-262731801":[{m:"Rf2-f6",e:5}],"-1#-1247562803":[{m:"c7-c6",e:5}],"1#1992575222":[{m:"Eg1-e3",e:5}],"-1#-262320604":[{m:"Cb8-a8",e:5}],"1#-637990075":[{m:"g4-g5",e:8},{m:"Ri1-i2",e:8},{m:"Ri1-h1",e:8}],"-1#-1791820376":[{m:"Ri10-i9",e:5}],"1#-728225332":[{m:"Hb1-a3",e:5}],"-1#-884566636":[{m:"Ri9-d9",e:5}],"1#876756011":[{m:"Af1-e2",e:5}],"-1#1813763809":[{m:"c7-c6",e:5}],"1#-1350816294":[{m:"Ri1-h1",e:5}],"-1#-1511950614":[{m:"Ch8-g8",e:5}],"1#-753248224":[{m:"Cc3-f3",e:5}],"-1#-1933752531":[{m:"Ri10-i9",e:5}],"1#-854092983":[{m:"Ri2-d2",e:5}],"-1#1664761770":[{m:"Cb8-c8",e:5}],"1#-272337464":[{m:"Cb3-b7",e:5}],"-1#-213320398":[{m:"c7-c6",e:5}],"1#808388105":[{m:"Hb1-a3",e:5}],"-1#804371025":[{m:"Ri9-d9",e:5}],"1#-789244946":[{m:"Ra1-a2",e:5}],"-1#-748400523":[{m:"Ec10-e8",e:5}],"1#1609041249":[{m:"Hh1-g3",e:5}],"-1#274049193":[{m:"Hb10-c8",e:5}],"1#21346837":[{m:"Hb1-a3",e:5}],"-1#513476173":[{m:"Ra10-b10",e:5}],"1#652814548":[{m:"Ra1-b1",e:5}],"-1#273012776":[{m:"Rb10-b6",e:5}],"1#1666687422":[{m:"Ri1-h1",e:5}],"-1#1774910094":[{m:"Eg10-e8",e:5}],"1#-1432893839":[{m:"Cc3xc7",e:5}],"-1#-526922524":[{m:"Hh10-i8",e:5}],"1#1760361240":[{m:"Cc7xc10+",e:5}],"-1#223790222":[{m:"Ee8xc10",e:5}],"1#803600951":[{m:"Rh1xh8",e:5}],"-1#-939932452":[{m:"Af10-e9",e:5}],"1#-883818418":[{m:"Cb3-c3",e:5}],"-1#-1044765865":[{m:"Rb6xb1",e:5}],"1#1666782817":[{m:"Ha3xb1",e:5}],"-1#-1224434981":[{m:"Hc8-a9",e:5}],"1#258772758":[{m:"g4-g5",e:5}],"-1#1135049211":[{m:"i7-i6",e:5}],"1#1279964964":[{m:"a4-a5",e:5}],"-1#1646531176":[{m:"Ec10-e8",e:5}],"1#279640500":[{m:"Rh8xe8",e:5}],"-1#583636891":[{m:"Hi8-h6",e:5}],"1#-173821019":[{m:"Re8-h8",e:5}],"-1#1634379957":[{m:"Hh6-f7",e:5}],"1#-1356672652":[{m:"Eg1-i3",e:5}],"-1#1497436359":[{m:"Ha9-b7",e:5}],"1#1552056503":[{m:"Cc3-e3",e:5}],"-1#-503905467":[{m:"Hb7-d6",e:5}],"1#1995320699":[{m:"Rh8-h6",e:5}],"-1#214444587":[{m:"e7-e6",e:5}],"1#-1374003364":[{m:"Ce3xe6+",e:5}],"-1#1350756944":[{m:"Cd8-e8",e:5}],"1#364019322":[{m:"Hg3-f5",e:5}],"-1#1128279325":[{m:"Hd6xe4",e:5}],"1#1104088368":[{m:"Ec1-e3",e:5}],"-1#-215358695":[{m:"Ri10-f10",e:5}],"1#2063422685":[{m:"Hf5xg7",e:5}],"-1#941607446":[{m:"Rf10-g10",e:5}],"1#195998442":[{m:"g5-g6",e:5}],"-1#1772240377":[],"1#1929856502":[{m:"Hh1-g3",e:5}],"-1#1018882110":[{m:"Ec10-e8",e:5}],"1#271116509":[{m:"Ri1-h1",e:8.571}],"-1#448115693":[{m:"Ri9-d9",e:8.571}],"1#-441378222":[{m:"Ec1-e3",e:8.571},{m:"Hb1-a3",e:8.571},{m:"Cc3-f3",e:8.571}],"-1#1465382011":[{m:"Hh10-i8",e:7.5},{m:"Rd9-d4",e:7.5}],"1#-550714489":[{m:"Ad1-e2",e:6.667}],"-1#-1876569465":[{m:"Rd9-d6",e:6.667}],"1#2049220740":[{m:"Hb1-a3",e:6.667},{m:"c4-c5",e:6.667}],"-1#-1254646772":[{m:"i7-i6",e:5}],"1#1179273150":[{m:"Hb1-a3",e:5}],"-1#1502936038":[{m:"Hh10-i8",e:5}],"1#-772813798":[{m:"Cb3-b4",e:5}],"-1#1772605369":[{m:"Rd4-d3",e:5}],"1#1729492835":[{m:"Ra1-c1",e:5}],"-1#-93346294":[{m:"Hh10-i8",e:5}],"1#1913950710":[{m:"Af1-e2",e:5}],"-1#709720892":[{m:"a7-a6",e:5}],"1#779052606":[{m:"Cb3-b7",e:5}],"-1#853798596":[{m:"Ad10-e9",e:5}],"1#-568142283":[{m:"Cb7xe7",e:5}],"-1#-817826805":[{m:"Rd9-d6",e:5}],"1#625051144":[{m:"Ra1-b1",e:5}],"-1#334329588":[{m:"Hb10-a8",e:5}],"1#1501181686":[{m:"Rb1-b7",e:5}],"-1#2041486677":[{m:"i7-i6",e:5}],"1#1984123786":[{m:"Rh1-h7",e:5}],"-1#-532980612":[{m:"Hh10-i8",e:6.667}],"1#1749052288":[{m:"Cb3-e3",e:6.667}],"-1#-1040122854":[{m:"Ad10-e9",e:6.667},{m:"i7-i6",e:6.667}],"1#784450795":[{m:"Hb1-c3",e:5}],"-1#2090446758":[{m:"Rd9-d6",e:5}],"1#-1768366683":[{m:"Ra1-b1",e:5}],"-1#-1607193255":[{m:"i7-i6",e:5}],"1#-840092987":[{m:"Hb1-c3",e:5}],"-1#-1615505016":[{m:"Rd9-d6",e:5}],"1#1974741899":[{m:"Rh1-h7",e:5}],"-1#-815910410":[{m:"Hb10-d9",e:5}],"1#-981709076":[{m:"Ra1-b1",e:5}],"1#1001843627":[{m:"Hh1-g3",e:5}],"-1#1946895971":[{m:"Ra10-a8",e:5}],"1#-1391716677":[{m:"Hb1-a3",e:5}],"-1#-1294816541":[{m:"Ra8-f8",e:5}],"1#-1256101827":[{m:"Ra1-b1",e:5}],"-1#-2087872319":[{m:"Hb10-c8",e:5}],"1#-1835169155":[{m:"Eg1-e3",e:5}],"-1#335842479":[{m:"Eg10-e8",e:5}],"1#-681988016":[{m:"Cc3xc7",e:5}],"-1#-1655063867":[{m:"Hh10-f9",e:5}],"1#1782110150":[{m:"Cb3-d3",e:5}],"-1#1357420605":[{m:"Rf8-f6",e:5}],"1#-809862479":[{m:"Rb1-b9",e:5}],"-1#-356431180":[{m:"Hf9-d8",e:5}],"1#723614982":[{m:"Cd3-c3",e:5}],"-1#113518229":[{m:"Ad10-e9",e:5}],"1#-368763292":[{m:"Ri1-h1",e:5}],"-1#-526891692":[{m:"Ch8-h6",e:5}],"1#-615432618":[{m:"Rh1-h5",e:5}],"-1#1268429054":[{m:"Hd8-e6",e:5}],"1#-1312159935":[{m:"e4-e5",e:5}],"-1#910549517":[{m:"He6xc7",e:5}],"1#-2029727486":[{m:"Cc3xc7",e:5}],"-1#1086523112":[{m:"Cg8-h8",e:5}],"1#-205202318":[{m:"e5-e6",e:5}],"-1#2032741343":[{m:"Ch6xe6+",e:5}],"1#-1823200698":[{m:"Ad1-e2",e:5}],"-1#-597869754":[{m:"Ch8-f8",e:5}],"1#1422859285":[{m:"Hg3-e4",e:5}],"-1#-1213028086":[{m:"Rf6-f4",e:5}],"1#-72937741":[{m:"He4-d6",e:5}],"-1#-1606369499":[{m:"Rf4-d4",e:5}],"1#1938671599":[{m:"Hd6xc8",e:5}],"-1#-742677731":[{m:"Cf8xc8",e:5}],"1#-1169358702":[{m:"Rh5-e5",e:5}],"-1#-1151070137":[{m:"Ri10-h10",e:5}],"1#-517640778":[{m:"Rb9-b5",e:5}],"-1#-2127734535":[{m:"Rh10-h4",e:5}],"1#1164752814":[{m:"Cc7xg7",e:5}],"-1#-33886560":[{m:"a7-a6",e:5}],"1#-103222366":[{m:"Rb5-b7",e:5}],"-1#-1669374645":[{m:"Cc8xc1",e:5}],"1#-908532683":[{m:"Ha3-c2",e:5}],"-1#147372884":[{m:"Rd4-d2",e:5}],"1#507482481":[{m:"Hh1-g3",e:9}],"-1#1367489721":[{m:"Ec10-e8",e:5},{m:"Hh10-i8",e:9},{m:"Hh10-g8",e:9}],"1#-1822767116":[{m:"Ri1-h1",e:5}],"-1#-1714971452":[{m:"Ri10-h10",e:5}],"1#-1014570699":[{m:"g4-g5",e:5}],"-1#-1890773032":[{m:"Ch8-h6",e:5}],"1#-1266389798":[{m:"Ec1-e3",e:5}],"-1#107119347":[{m:"Ch6-a6",e:5}],"1#481948648":[{m:"Cb3-a3",e:5}],"-1#791149188":[{m:"Rh10xh1",e:5}],"1#391804986":[{m:"Hg3xh1",e:5}],"-1#458589025":[{m:"Hb10-d9",e:5}],"1#293076091":[{m:"Hb1-d2",e:5}],"-1#-1020203650":[{m:"Cb8-a8",e:5}],"1#171105982":[{m:"Ca3xa6",e:5}],"-1#-1627007404":[{m:"a7xa6",e:5}],"1#1973122184":[{m:"Ra1-b1",e:5}],"-1#1127711860":[{m:"Ca8xa4",e:5}],"1#-1760898479":[{m:"Cc3-a3",e:5}],"-1#-1338338095":[{m:"Ra10-a8",e:5}],"1#1765655561":[{m:"Rb1-b4",e:5}],"-1#962312019":[{m:"Ca4-a5",e:5}],"1#-657712281":[{m:"Rb4-b6",e:5}],"-1#-14818383":[{m:"Ra8-d8",e:5}],"1#1444979661":[{m:"Hd2-b3",e:5}],"-1#451574151":[{m:"Ca5-f5",e:5}],"1#-1860227093":[{m:"Rb6-f6",e:5}],"-1#-1286678969":[{m:"Cf5-b5",e:5}],"1#594033441":[{m:"Rf6xa6",e:5}],"1#1207396079":[{m:"Hh1-g3",e:8.889}],"-1#139119399":[{m:"Hh10-g8",e:8.889}],"1#-896389014":[{m:"Ri1-h1",e:8.889},{m:"Hb1-a3",e:8.889}],"-1#-1072731302":[{m:"Ri10-h10",e:8.75}],"1#-1706158421":[{m:"Rh1-h5",e:8.889},{m:"Hb1-a3",e:8.889}],"-1#176527363":[{m:"Ec10-e8",e:8.75},{m:"Ch8-i8",e:8.75}],"1#639080672":[{m:"Ec1-e3",e:5}],"-1#-1796114743":[{m:"Ch8-i8",e:5}],"1#-1458564038":[{m:"Rh5-d5",e:5}],"1#929364720":[{m:"Rh5-f5",e:8.571},{m:"Rh5-d5",e:8.571}],"-1#145892828":[{m:"Eg10-e8",e:8.333}],"-1#-2054116621":[{m:"Ch8-h4",e:5}],"1#-1608937063":[{m:"Cc3xc7",e:5}],"-1#-367420660":[{m:"Hb10-a8",e:5}],"1#-1601250546":[{m:"Ec1-e3",e:5}],"-1#308819239":[{m:"Ch4xe4+",e:5}],"1#-1807079009":[{m:"Ad1-e2",e:5}],"-1#-616351585":[{m:"Rh10xh1",e:5}],"1#-482428383":[{m:"Hg3xh1",e:5}],"-1#-281984646":[{m:"Cb8-e8",e:5}],"-1#-716403662":[{m:"Ri10-h10",e:5}],"1#-1894911549":[{m:"Ad1-e2",e:5}],"-1#-1073422141":[{m:"Ch8-i8",e:5}],"1#-35290576":[{m:"Ri1-i2",e:5}],"-1#-1465790888":[{m:"a7-a6",e:5}],"1#-1400646822":[{m:"Ri2-f2",e:5}],"-1#-1604970208":[{m:"Hb10-a8",e:5}],"1#-356427486":[{m:"Rf2-f5",e:5}],"-1#382784900":[{m:"Eg10-e8",e:5}],"1#-712119941":[{m:"Ec1-e3",e:5}],"-1#1735067474":[{m:"c7-c6",e:5}],"1#-1542652823":[{m:"Ra1-d1",e:5}],"-1#-837965352":[{m:"Af10-e9",e:5}],"1#-1029280438":[{m:"a4-a5",e:5}],"-1#-322385914":[{m:"a6xa5",e:5}],"1#-964952935":[{m:"Rf5xa5",e:5}],"-1#-123838875":[{m:"Rh10-f10",e:5}],"1#920036129":[{m:"g4-g5",e:5}],"-1#2048742860":[{m:"Rf10-f6",e:5}],"1#258486367":[{m:"g5xg6",e:5}],"1#2017120656":[{m:"Hh1-g3",e:8.333}],"-1#931626072":[{m:"g7-g6",e:8.333},{m:"Cb8-d8",e:8.333},{m:"Cb8-c8",e:8.333},{m:"Ch8-d8",e:8.333}],"1#1121815333":[{m:"Ri1-h1",e:5}],"-1#1212207125":[{m:"Hh10-g8",e:5}],"1#-1969738920":[{m:"Hb1-a3",e:5}],"-1#-1790535936":[{m:"Ra10-a9",e:5}],"1#-1927344575":[{m:"Cc3xc7",e:5}],"-1#-954268460":[{m:"Ch8-i8",e:5}],"1#-83991001":[{m:"Ad1-e2",e:5}],"-1#-1242073305":[{m:"Cb8-d8",e:5}],"1#-659364908":[{m:"Cc7-c5",e:5}],"-1#774162900":[{m:"Eg10-e8",e:5}],"1#1522722987":[{m:"Cb3-b7",e:5}],"-1#1179541585":[{m:"Hh10-g8",e:5}],"1#-2070504676":[{m:"Hb1-a3",e:5}],"-1#-1689770172":[{m:"Ra10-b10",e:5}],"1#-1556477475":[{m:"Ra1-b1",e:5}],"-1#-1785267935":[{m:"Ri10-h10",e:5}],"1#-807959344":[{m:"a4-a5",e:5}],"-1#-507960932":[{m:"g7-g6",e:5}],"1#-1797007647":[{m:"Eg1-e3",e:5}],"-1#310038579":[{m:"Cd8-d3",e:5}],"1#-1149684166":[{m:"Ri1-h1",e:5}],"-1#-1310429942":[{m:"Eg10-e8",e:5}],"1#1924747765":[{m:"Hb1-a3",e:5}],"-1#1835527597":[{m:"Hh10-f9",e:5}],"1#-1710849874":[{m:"Cb3-b7",e:5}],"-1#-2037774252":[{m:"a7-a6",e:5}],"1#-2102913706":[{m:"Ra1-b1",e:5}],"-1#-1274747478":[{m:"Cc8-b8",e:5}],"1#955953096":[{m:"Cb7-a7",e:5}],"1#544527765":[{m:"Ri1-h1",e:6.667}],"-1#719949477":[{m:"Hh10-g8",e:6.667}],"1#-399411736":[{m:"Hb1-a3",e:6.667},{m:"Ec1-e3",e:6.667}],"-1#-135280208":[{m:"Cb8-c8",e:6.667}],"1#2064745426":[{m:"Ra1-b1",e:6.667},{m:"a4-a5",e:6.667}],"-1#1524079553":[{m:"Cb8-c8",e:5}],"1#-701902429":[{m:"Hb1-d2",e:5}],"-1#74367142":[{m:"Ra10-b10",e:5}],"1#117810746":[{m:"Hh1-g3",e:6.667}],"-1#1220021234":[{m:"Hh10-g8",e:6.667},{m:"Hh10-i8",e:6.667}],"1#-1973358401":[{m:"Ri1-h1",e:5}],"-1#-2130859121":[{m:"Ri10-h10",e:5}],"1#-625158530":[{m:"Rh1-h7",e:5}],"-1#1616301059":[{m:"Ce8-d8",e:5}],"1#627464233":[{m:"Rh7xg7",e:5}],"-1#1428356808":[{m:"Eg10-e8",e:5}],"1#-1770012105":[{m:"Hb1-a3",e:5}],"-1#-1985905041":[{m:"Hb10-a8",e:5}],"1#-1019855251":[{m:"Ra1-b1",e:5}],"-1#-174403951":[{m:"a7-a6",e:5}],"1#-239545453":[{m:"Rg7-g5",e:5}],"-1#-1543774613":[{m:"Ra10-a9",e:5}],"1#-1146992854":[{m:"a4-a5",e:5}],"-1#-1781734810":[{m:"a6xa5",e:5}],"1#-1082140935":[{m:"Rg5xa5",e:5}],"-1#-904792931":[{m:"Hg8-h6",e:5}],"1#1473780754":[{m:"Cc3-e3",e:5}],"-1#765035873":[{m:"Ch8-g8",e:5}],"1#1533193131":[{m:"Ce3xe7+",e:5}],"-1#529648425":[{m:"Af10-e9",e:5}],"1#322572219":[{m:"Ec1-e3",e:5}],"1#-1060946930":[{m:"Ri1-h1",e:5}],"-1#-899782850":[{m:"Ri10-h10",e:5}],"1#-1877009713":[{m:"Rh1-h5",e:5}],"-1#13931623":[{m:"Hb10-c8",e:5}],"1#298092251":[{m:"Hb1-a3",e:5}],"-1#236599939":[{m:"a7-a6",e:5}],"1#171452289":[{m:"Cc3xc7",e:5}],"-1#1077423380":[{m:"Ch8-g8",e:5}],"1#918750174":[{m:"Rh5xh10",e:5}],"-1#1588047502":[{m:"Hi8xh10",e:5}],"1#1214339542":[{m:"Ra1-b1",e:5}],"-1#2127407402":[{m:"e7-e6",e:5}],"1#-601891747":[{m:"Cb3-e3",e:5}],"-1#1985956807":[{m:"Cg8xg4",e:5}],"1#-2039165737":[{m:"c4-c5",e:5}],"-1#1231548511":[{m:"Hh10-i8",e:5}],"1#-1055078493":[{m:"Rb1-b6",e:5}],"-1#-1418298530":[{m:"Ce8-e9",e:5}],"1#-2012842871":[{m:"Rb6xe6",e:5}],"-1#-628099386":[{m:"Ec10-e8",e:5}],"1#1371857065":[{m:"Hh1-g3",e:8.571}],"-1#511266145":[{m:"Hb10-a8",e:8.571},{m:"Hh10-g8",e:8.571}],"1#1424887139":[{m:"Ri1-h1",e:5}],"-1#1584617043":[{m:"Hh10-g8",e:5}],"1#-1666470626":[{m:"a4-a5",e:6.667},{m:"Ec1-e3",e:6.667}],"-1#-1295710126":[{m:"Ri10-i9",e:5}],"1#-210772938":[{m:"Hb1-a3",e:5}],"-1#-323919762":[{m:"Ri9-d9",e:5}],"1#330680785":[{m:"Af1-e2",e:5}],"-1#1273766683":[{m:"Rd9-d5",e:5}],"1#992155650":[{m:"Rh1-h7",e:5}],"-1#-2117533057":[{m:"g7-g6",e:5}],"1#-191630078":[{m:"Rh7-g7",e:5}],"-1#776815415":[{m:"Ri10-i9",e:5}],"1#1877448531":[{m:"Rh1-h7",e:5}],"-1#-720532178":[{m:"g7-g6",e:5}],"1#-1604879789":[{m:"Rh7-g7",e:5}],"-1#-1313502277":[{m:"Ri9-f9",e:5}],"1#-1510843815":[{m:"Ad1-e2",e:5}],"-1#-352629927":[{m:"Rf9-f6",e:5}],"1#1584049145":[{m:"Hb1-a3",e:5}],"-1#1102321569":[{m:"a7-a6",e:5}],"1#-593381844":[{m:"Ri1-i2",e:8.333},{m:"Ri1-h1",e:8.333}],"-1#-1981416892":[{m:"Ri10-h10",e:6.667}],"1#-744192075":[{m:"Ec1-e3",e:6.667}],"-1#1631742364":[{m:"Hb10-a8",e:6.667}],"1#735390110":[{m:"Ri2-d2",e:6.667}],"-1#-2047310467":[{m:"Rh10-h6",e:6.667}],"1#539966503":[{m:"Rd2-d8",e:6.667},{m:"Hb1-a3",e:6.667}],"-1#-1653084471":[{m:"Cb8xb1+",e:5}],"-1#1072791679":[{m:"Cb8-b4",e:5}],"-1#-700650212":[{m:"Ri10-i9",e:7.5},{m:"Hh10-g8",e:5}],"1#-1751762568":[{m:"Cc3xc7",e:6.667}],"-1#-577358867":[{m:"g7-g6",e:6.667}],"1#-1462975344":[{m:"Rh1-h5",e:6.667}],"-1#940001848":[{m:"Hb10-a8",e:6.667}],"1#1922042426":[{m:"Cc7-c8",e:6.667}],"-1#-676486946":[{m:"Ri9-d9",e:6.667}],"1#682166625":[{m:"Ec1-e3",e:6.667}],"1#-260740385":[{m:"Ri1-i3",e:9.091},{m:"g4-g5",e:9.091},{m:"Hh1-g3",e:9.091}],"-1#1437243619":[{m:"Ri10-h10",e:5}],"1#267117842":[{m:"Ri3-d3",e:5}],"-1#-1782816174":[{m:"Hb10-a8",e:5}],"1#-550821296":[{m:"Hh1-g3",e:5}],"-1#-1869181032":[{m:"Ch8-i8",e:5}],"1#-1384649365":[{m:"Ec1-e3",e:5}],"-1#529597250":[{m:"Rh10-h6",e:5}],"1#-1169769960":[{m:"c4-c5",e:5}],"-1#1968539280":[{m:"Eg10-e8",e:5}],"1#-1240941969":[{m:"Cc3-c2",e:5}],"-1#-80457341":[{m:"Af10-e9",e:5}],"1#-140536559":[{m:"Ad1-e2",e:5}],"-1#-1198095343":[{m:"Cb8-d8",e:5}],"-1#-1128358862":[{m:"Cb8-e8",e:8.333},{m:"Ri10-h10",e:8.333}],"1#-1995002982":[{m:"Hh1-g3",e:5}],"-1#-961870254":[{m:"Hb10-c8",e:5}],"1#-675605266":[{m:"Ri1-h1",e:5}],"-1#-584691746":[{m:"Ra10-b10",e:5}],"1#-447454905":[{m:"Ra1-a3",e:5}],"-1#-2024252946":[{m:"Ri10-h10",e:5}],"1#-419438141":[{m:"g4-g5",e:8}],"-1#-1455272949":[{m:"Hb10-a8",e:8.333},{m:"Ch8-i8",e:8.333}],"1#-472577015":[{m:"a4-a5",e:5}],"-1#-843339451":[{m:"Ch8-i8",e:5}],"1#-1801244936":[{m:"Cc3xc7",e:8}],"-1#-1077360873":[{m:"Ri10-h10",e:8}],"1#-443958554":[{m:"g4-g5",e:8},{m:"Ri1-h1",e:8},{m:"Ri1-i2",e:8}],"-1#-283844138":[{m:"Ch8-h4",e:6.667},{m:"Ri10-h10",e:8.75}],"1#-895624516":[{m:"g4-g5",e:5}],"-1#-2041172911":[{m:"Ch4-g4",e:5}],"1#-1756605955":[{m:"Ec1-e3",e:5}],"-1#-1328679282":[{m:"g7-g6",e:5}],"1#-979959309":[{m:"Ec1-e3",e:5}],"-1#2003955674":[{m:"Hb10-a8",e:5}],"1#1038528472":[{m:"c4-c5",e:5}],"-1#-218786992":[{m:"Cb8-d8",e:5}]};
//# sourceMappingURL=xiangqi-model.js.map
