exports.config = {"status":true,"model":{"title-en":"Hnefatafl","summary":"11x11 board (from Scandinavia)","rules":{"en":"rules-tafl-hnefatafl.html","fr":"rules-tafl-hnefatafl-fr.html"},"js":["tafl-model.js"],"plazza":"true","thumbnail":"thumb-tafl-hnefatafl.png","module":"tafl","description":{"en":"description.html","fr":"description-fr.html"},"credits":{"en":"credits.html","fr":"credits-fr.html"},"gameOptions":{"preventRepeat":true,"uctTransposition":"states","levelOptions":{"attackersCountFactor":10,"defendersCountFactor":-10,"kingPathFactor":-20,"kingFreedomFactor":-0.1,"distKingFactor":-0.05},"exclude":[0,10,110,120],"attackers":1,"longMove":true,"initial":{"attackers":[3,4,5,6,7,16,33,44,55,66,77,56,43,54,65,76,87,64,113,114,115,116,117,104],"defenders":{"king":60,"soldiers":[38,48,49,50,58,59,61,62,70,71,72,82]}},"homeCatch":true,"privateHome":true,"centerDistance":5},"demoRandom":true,"visuals":["res/visuals/hnefatafl-600x600-3d.jpg","res/visuals/hnefatafl-600x600-2d.jpg"],"levels":[{"name":"easy","label":"Easy","ai":"uct","playoutDepth":0,"minVisitsExpand":1,"c":0.65,"uncertaintyFactor":3,"useAlphaBeta":true,"maxNodes":1000},{"name":"fast","label":"Fast [1sec]","ai":"uct","playoutDepth":0,"minVisitsExpand":1,"c":0.65,"uncertaintyFactor":3,"useAlphaBeta":true,"maxDuration":1,"isDefault":true},{"name":"strong","label":"Strong","ai":"uct","playoutDepth":0,"minVisitsExpand":1,"c":0.65,"uncertaintyFactor":3,"useAlphaBeta":true,"maxNodes":10000,"maxDuration":10}]},"view":{"title-en":"Tafl view","visuals":{"600x600":["res/visuals/hnefatafl-600x600-3d.jpg","res/visuals/hnefatafl-600x600-2d.jpg"]},"js":["tafl-xd-view.js"],"xdView":true,"css":["tafl.css"],"preferredRatio":1,"switchable":true,"module":"tafl","useNotation":true,"sounds":{"death1":"death1","death2":"death2","death3":"death3","move1":"move1","move3":"move3"},"defaultOptions":{"sounds":true,"moves":true,"notation":false},"skins":[{"name":"tafl3d","title":"3D Classic","3d":true,"camera":{"limitCamMoves":true,"radius":14,"rotationAngle":90,"elevationAngle":89.9,"elevationMin":2,"elevationMax":89.9},"world":{"lightIntensity":0.8,"skyLightIntensity":0.5,"lightCastShadow":false,"fog":false,"color":1118481,"lightPosition":{"x":10,"y":5,"z":0},"lightShadowDarkness":0.55,"ambientLightColor":4473924},"preload":["image|/res/xd-view/meshes/woodtoken-diffuse-black.jpg","image|/res/xd-view/meshes/woodtoken-diffuse.jpg","image|/res/images/ardriboard_bgx1024.jpg","image|/res/images/ardricellborders.png","image|/res/images/ardriblackcell.png","image|/res/images/ardrikingcell.png","image|/res/images/blackcell.png","image|/res/images/whitecell.png","smoothedfilegeo|0|/res/xd-view/meshes/taflboard.js","smoothedfilegeo|0|/res/xd-view/meshes/ring-target.js","smoothedfilegeo|0|/res/xd-view/meshes/woodtoken.js"]},{"name":"tafl2d","title":"2D Classic","3d":false,"preload":["image|/res/xd-view/meshes/ardri-sprites.png","image|/res/images/ardriboard_bgx1024.jpg","image|/res/images/ardricellborders.png","image|/res/images/ardriblackcell.png","image|/res/images/ardrikingcell.png","image|/res/images/blackcell.png","image|/res/images/whitecell.png"]}],"animateSelfMoves":false,"useShowMoves":false}}