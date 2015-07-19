var template;
var f,g;
var db;

var CERT  = $rdf.Namespace("http://www.w3.org/ns/auth/cert#");
var CHAT  = $rdf.Namespace("https://ns.rww.io/chat#");
var CURR  = $rdf.Namespace("https://w3id.org/cc#");
var DCT   = $rdf.Namespace("http://purl.org/dc/terms/");
var FACE  = $rdf.Namespace("https://graph.facebook.com/schema/~/");
var FOAF  = $rdf.Namespace("http://xmlns.com/foaf/0.1/");
var LIKE  = $rdf.Namespace("http://ontologi.es/like#");
var LDP   = $rdf.Namespace("http://www.w3.org/ns/ldp#");
var MBLOG = $rdf.Namespace("http://www.w3.org/ns/mblog#");
var OWL   = $rdf.Namespace("http://www.w3.org/2002/07/owl#");
var PIM   = $rdf.Namespace("http://www.w3.org/ns/pim/space#");
var RDF   = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
var RDFS  = $rdf.Namespace("http://www.w3.org/2000/01/rdf-schema#");
var SIOC  = $rdf.Namespace("http://rdfs.org/sioc/ns#");
var SOLID = $rdf.Namespace("http://www.w3.org/ns/solid/app#");
var URN   = $rdf.Namespace("urn:");
var VCARD = $rdf.Namespace("http://www.w3.org/2006/vcard/ns#");

var AUTHENDPOINT = "https://databox.me/";
var PROXY = "https://rww.io/proxy.php?uri={uri}";
var TIMEOUT = 5000;
var DEBUG = true;

var scope = {};
var gg;

var defaultWallets = ['https://wallet.databox.me/Public/.wallet/github.com/melvincarvalho/wallet/wallet#this',
  'https://gitpay.databox.me/Public/.wallet/github.com/linkeddata/SoLiD/wallet#this'];

$rdf.Fetcher.crossSiteProxyTemplate=PROXY;

var App = angular.module('myApp', [
  'lumx',
  'ngAudio',
]);

App.config(function($locationProvider) {
  $locationProvider
  .html5Mode({ enabled: true, requireBase: false });
});

App.controller('Main', function($scope, $http, $location, $timeout, $sce, ngAudio, LxNotificationService, LxProgressService, LxDialogService) {
  template = $scope;

  // INIT functions
  //
  // save app configuration if it's the first time the app runs
  $scope.initApp = function() {
    $scope.init();
  };

  // set init variables
  $scope.init = function() {

    $scope.queue = [];
    $scope.knows = [];
    $scope.preferences = [];
    $scope.storage = [];
    $scope.fetched = {};
    $scope.seeAlso = [];
    $scope.wallets = [];
    $scope.workspaces = [];
    $scope.my = {};
    $scope.friends = [];
    $scope.keys = [];
    $scope.initStore();
    $scope.initUI();
    $scope.subs = [];
    $scope.sockets = [];
    $scope.selects = {};
    $scope.main = {'description' : 'wallet'};


    // start browser cache DB
    db = new Dexie("chrome:theSession");
    db.version(1).stores({
      cache: 'why,quads',
    });
    db.open();

    $scope.show = {};

  };

  $scope.initUI = function() {
    $scope.defaultSound = 'audio/button-3.mp3';
    $scope.initialized = true;
    $scope.loggedIn = false;
    $scope.loginTLSButtonText = "Login";
    $scope.audio = ngAudio.load($scope.defaultSound);
    $scope.audioAlt = undefined;
  };

  $scope.initStore = function() {
    // start in memory DB
    g = $rdf.graph();
    f = $rdf.fetcher(g);
    // add CORS proxy
    var PROXY      = "https://data.fm/proxy?uri={uri}";
    var AUTH_PROXY = "https://rww.io/auth-proxy?uri=";
    //$rdf.Fetcher.crossSiteProxyTemplate=PROXY;
    var kb         = $rdf.graph();
    var fetcher    = $rdf.fetcher(kb);
  };



  // RENDER functions
  //
  //
  $scope.render = function() {
    $scope.renderMain();
    $scope.renderProfile();
    $scope.renderFriends();
    $scope.renderWallets();
    $scope.renderWallet();
    connectToSockets();
  };

  $scope.renderMain = function () {
  };

  $scope.renderProfile = function() {
    if (!$scope.my) return;
    if (!$scope.user) return;

    $scope.my.id = $scope.user;

    var avatar = g.statementsMatching($rdf.sym($scope.my.id), FOAF('img'), undefined);
    if (!avatar.length) {
      avatar = g.statementsMatching($rdf.sym($scope.my.id), FOAF('depiction'), undefined);
    }
    if (avatar.length) {
      $scope.my.picture = avatar[0].object.value;
    }

    var name = g.statementsMatching($rdf.sym($scope.my.id), FOAF('name'), undefined);
    if (name.length) {
      $scope.my.name = name[0].object.value;
    }

  };

  $scope.renderWallet = function() {
    if (!$scope.wallet) return;

    var wallet = getById($scope.wallets, $scope.wallet);

    $scope.main = wallet;

  };

  $scope.renderFriends = function() {
    for (var i=0; i<$scope.knows.length; i++) {

      var avatar = g.statementsMatching($rdf.sym($scope.knows[i]), FOAF('img'), undefined);
      if (!avatar.length) {
        avatar = g.statementsMatching($rdf.sym($scope.knows[i]), FOAF('depiction'), undefined);
      }

      var name = g.statementsMatching($rdf.sym($scope.knows[i]), FOAF('name'), undefined);

      var friend = { 'id' : $scope.knows[i] };
      if (name.length) {
        friend.name = name[0].object.value;
      }
      if (avatar.length) {
        friend.picture = avatar[0].object.value;
      }

      addToIds($scope.friends, friend);
    }

    $scope.friends.sort(function(a, b){
      if (!a.picture) return 1;
    });
  };

  $scope.renderWallets = function() {
    var i;
    console.log('rendering wallets');

    for (i=0; i<$scope.wallets.length; i++) {

      var wallet = $scope.wallets[i];
      if (!wallet.id) continue;

      var description = g.statementsMatching($rdf.sym(wallet.id), DCT('description'));
      if (description.length) {
        wallet.description = description[0].object.value;
      }

      var api = g.statementsMatching($rdf.sym(wallet.id), CURR('api'));
      if (description.length) {
        wallet.api = api[0].object.value;
      }

      var tx = g.statementsMatching($rdf.sym(wallet.id), CURR('tx'));
      if (tx.length) {
        wallet.trades = tx[0].object.value;
      }

      var inbox = g.statementsMatching($rdf.sym(wallet.id), CURR('inbox'));
      if (inbox.length) {
        wallet.inbox = inbox[0].object.value;
      }

      var hasSound = g.statementsMatching($rdf.sym(wallet.id), VCARD('hasSound'));
      if (hasSound.length) {
        wallet.hasSound = hasSound[0].object.value;
      }

      //console.log($scope.wallets[i]);

    }

    $scope.wallets.sort(function(a, b){
    });
  };

  $scope.refresh = function() {
    console.log('refresh');
    $scope.render();
  };

  $scope.display = function(wallet) {
    $scope.wallet = wallet;
    $scope.renderWallet();
    console.log(wallet);
    fetchBalance(wallet);
    fetchTx(wallet);
    $scope.render();
    $scope.activeTab = 0;
  };


  // QUEUE functions
  //
  //
  // QUEUE
  function updateQueue() {
    var i, j;
    var workspaces;
    console.log('updating queue');
    addToQueue($scope.queue, $scope.user);

    for (i=0; i<defaultWallets.length; i++) {
      addToIds($scope.wallets, {'id': defaultWallets[i]});
      addToQueue($scope.queue, defaultWallets[i]);
    }

    workspaces = g.statementsMatching($rdf.sym($scope.user), PIM('storage'), undefined);
    for (i=0; i<workspaces.length; i++) {
      addToArray($scope.storage, workspaces[i].object.value);
      addToQueue($scope.queue, workspaces[i].object.value);
    }


    var knows = g.statementsMatching($rdf.sym($scope.user), FOAF('knows'), undefined);
    for (i=0; i<knows.length; i++) {
      //console.log(knows[i].object.uri);
      addToArray($scope.knows, knows[i].object.value);
      addToQueue($scope.queue, knows[i].object.value);
      workspaces = g.statementsMatching($rdf.sym(knows[i].object.value), PIM('storage'), undefined);
      for (j=0; j<workspaces.length; j++) {
        addToArray($scope.storage, workspaces[j].object.value);
        addToQueue($scope.queue, workspaces[j].object.value);
      }
    }


    workspaces = g.statementsMatching(undefined, PIM('workspace'), undefined);
    for (i=0; i<workspaces.length; i++) {
      addToArray($scope.workspaces, workspaces[i].object.value);
      addToQueue($scope.queue, workspaces[i].object.value);
    }

    var preferences = g.statementsMatching($rdf.sym($scope.user), PIM('preferencesFile'), undefined);
    for (i=0; i<preferences.length; i++) {
      addToArray($scope.preferences, preferences[i].object.value);
      addToQueue($scope.queue, preferences[i].object.value);
    }


    var wallets = g.statementsMatching($rdf.sym($scope.user), CURR('wallet'), undefined);
    for (i=0; i<wallets.length; i++) {
      //console.log('wallet found : ' + wallets[i].object.value);
      addToIds($scope.wallets, {'id': wallets[i].object.value});
      addToQueue($scope.queue, wallets[i].object.value);
    }

    var keys = g.statementsMatching($rdf.sym($scope.user), CERT('key'), undefined);
    for (i=0; i<keys.length; i++) {
      //console.log('wallet found : ' + wallets[i].object.value);
      addToArray($scope.keys, keys[i].object.value);
      addToQueue($scope.queue, keys[i].object.value);
    }


    var seeAlso = g.statementsMatching($rdf.sym($scope.user), RDFS('seeAlso'), undefined);
    for (i=0; i<seeAlso.length; i++) {
      //console.log('seeAlso found : ' + seeAlso[i].object.value);
      addToArray($scope.seeAlso, seeAlso[i].object.value);
      addToQueue($scope.queue, seeAlso[i].object.value);
    }

  }


  function cache(uri) {
    console.log('caching ' + uri);
    var why = uri.split('#')[0];
    var quads = g.statementsMatching(undefined, undefined, undefined, $rdf.sym(why));

    db.cache.put({"why": why, "quads": quads}). then(function(){
      console.log('cached : ' + quads);
    }).catch(function(error) {
      console.error(error);
    });


  }


  // FETCH functions
  //
  //

  function fetchAll() {

    updateQueue();

    //if ($scope.queue.length === 0) return;

    for (var i=0; i<$scope.queue.length; i++) {
      if($scope.queue[i]) {
        if (!$scope.fetched[$scope.queue[i]]) {
          $scope.fetched[$scope.queue[i]] = new Date();
          fetch($scope.queue[i]);
        }
      } else {
        console.error('queue item ' + i + ' is undefined');
        console.log($scope.queue);
      }
    }

  }

  function fetch(uri) {
    $scope.fetched[uri] = new Date();
    console.log('fetching : ' + uri);
    //console.log(g);

    var why = uri.split('#')[0];

    db.cache.get(why).then(function(res){
      if (res && res.quads && res.quads.length) {
        console.log('uncached : ');
        console.log('fetched '+ uri +' from cache in : ' + (new Date() - $scope.fetched[uri]) );
        console.log(res);
        for(var i=0; i<res.quads.length; i++) {
          //console.log(res.quads);
          //console.log('item : ');
          //console.log(res.quads[i]);
          var t = res.quads[i].object.uri;
          if (t) {
            t = $rdf.sym(res.quads[i].object.value);
          } else {
            t = $rdf.term(res.quads[i].object.value);
          }
          //console.log(g.any( $rdf.sym(res.quads[i].subject.value), $rdf.sym(res.quads[i].predicate.value), t, $rdf.sym(res.quads[i].why.value) ));
          if (!g.any( $rdf.sym(res.quads[i].subject.value), $rdf.sym(res.quads[i].predicate.value), t, $rdf.sym(res.quads[i].why.value) )) {
            g.add( $rdf.sym(res.quads[i].subject.value), $rdf.sym(res.quads[i].predicate.value), t, $rdf.sym(res.quads[i].why.value) );
          }

        }
        f.requested[why] = 'requested';
        console.log('fetched '+ uri +' from cache in : ' + (new Date() - $scope.fetched[uri]) );
        $scope.render();
        fetchAll();
      } else {
        var quads = g.statementsMatching(undefined, undefined, undefined, $rdf.sym(why));
        f.nowOrWhenFetched(why, undefined, function(ok, body) {
          cache(uri);
          console.log('fetched '+ uri +' from rdflib in : ' + (new Date() - $scope.fetched[uri]) );
          $scope.render();
          fetchAll();
        });
      }
    }).catch(function(error) {
      console.error(error);
    });

  }

  function fetchBalance() {
    var balanceURI = $scope.main.api + 'balance?uri=' + encodeURIComponent($scope.user);
    $http.get(balanceURI).
    success(function(data, status, headers, config) {
      $scope.main.amount = data.amount;
      var wallet = getById($scope.wallets, $scope.wallet);
      if (!wallet.ledger) {
        wallet.ledger = {};
      }
      wallet.ledger[$scope.user] = data.amount;
      wallet.amount = data.amount;
    }).
    error(function(data, status, headers, config) {
      // log error
    });

  }

  function fetchTx() {
    var balanceURI = $scope.main.api + 'tx?uri=' + encodeURIComponent($scope.user);
    $http.get(balanceURI).
    success(function(data, status, headers, config) {
      $scope.main.tx = data;
      $scope.today = 0;
      for (var i=0; i<data.length; i++) {
        var name = data[i].source;
        if (name === $scope.user) name = data[i].destination;
        for (var j=0; j<$scope.friends.length; j++) {
          if ($scope.friends[j].id === name) {
            if ($scope.friends[j].name) {
              name = $scope.friends[j].name;
            }
          }
        }
        data[i].name = name;
        if (new Date(data[i].timestamp).toISOString().substr(0,10) === new Date().toISOString().substr(0,10)) {
          if (data[i].destination === $scope.user) {
            $scope.today += data[i].amount;
          }
        }
      }
    }).
    error(function(data, status, headers, config) {
      // log error
    });

  }


  $scope.invalidate = function(uri) {
    console.log('invalidate : ' + uri);
    uri = uri.split('#')[0];
    f.unload(uri);
    f.refresh($rdf.sym(uri));
  };

  // HELPER functions
  //
  //
  function addToArray(array, el) {
    if (!array) return;
    if (array.indexOf(el) === -1) {
      array.push(el);
    }
  }

  function addToFriends(array, el) {
    if (!array) return;
    for (var i=0; i<array.length; i++) {
      if (array[i].id === el.id) {
        return;
      }
    }
    array.push(el);
  }


  function addToIds(array, el) {
    if (!array) return;
    for (var i=0; i<array.length; i++) {
      if (array[i].id === el.id) {
        //array[i] = el;
        if (el.name) {
          array[i].name = el.name;
        }
        return;
      }
    }
    array.push(el);
  }

  function getById(array, id) {
    if (!array) return;
    for (var i=0; i<array.length; i++) {
      if (array[i].id === id) {
        return array[i];
      }
    }
  }


  function addToQueue(array, el) {
    if (!array) return;
    if (array.indexOf(el) === -1) {
      array.push(el);
    }
  }

  $scope.openDialog = function(elem, reset) {
    if (reset) {
      $scope.resetContact();
    }
    LxDialogService.open(elem);
    $(document).keyup(function(e) {
      if (e.keyCode===27) {
        LxDialogService.close(elem);
      }
    });
  };

  $scope.save = function() {
  };

  $scope.TLSlogin = function() {
    $scope.loginTLSButtonText = 'Logging in...';
    $http({
      method: 'HEAD',
      url: AUTHENDPOINT,
      withCredentials: true
    }).success(function(data, status, headers) {
      // add dir to local list
      var user = headers('User');
      if (user && user.length > 0 && user.slice(0,4) == 'http') {
        LxNotificationService.success('Login Successful!');
        $scope.loggedIn = true;
        $scope.user = user;
        fetchAll();
      } else {
        LxNotificationService.error('WebID-TLS authentication failed.');
        console.log('WebID-TLS authentication failed.');
      }
      $scope.loginTLSButtonText = 'Login';
    }).error(function(data, status, headers) {
      LxNotificationService.error('Could not connect to auth server: HTTP '+status);
      console.log('Could not connect to auth server: HTTP '+status);
      $scope.loginTLSButtonText = 'Login';
    });
  };



  $scope.logout = function() {
    $scope.init();
    LxNotificationService.success('Logout Successful!');
  };

  // SOCKETS
  //
  //
  function getWss(uri) {
    return 'wss://' + uri.split('/')[2];
  }

  function sendSub(message, socket) {
    socket.send(message);
  }







  function connectToSockets() {

    for (var i=0; i<$scope.wallets.length; i++) {
      if ($scope.wallets[i] && !$scope.wallets[i].socket) {
        var hash = CryptoJS.SHA256($scope.user);
        var tx = $scope.wallets[i].trades;
        if (tx) {
          connectToSocket(tx + hash + '/', $scope.subs);
        }
      }
    }

  }



  function connectToSocket(sub, subs) {
    var socket;

    // socket
    if ( subs.indexOf(sub) !== -1 ) {
      //console.log('Already subscribed to : ' + sub);
    } else {
      var wss = getWss(sub);
      if ($scope.subs.indexOf(wss) === -1) {
        console.log("Opening socket to : " + wss);
        //$scope.subs.push(wss);
        socket = new WebSocket(wss);
        $scope.sockets.push(socket);

        socket.onopen = function(){
          console.log(this);
          console.log(sub);
        };

        socket.onmessage = function(msg){
          console.log('Incoming message : ');
          var a = msg.data.split(' ');
          console.log(a[1]);
          //addToQueue($scope.queue, a[1]);
          //addToQueue($scope.queue, a[1] + '*');
          //$scope.invalidate(a[1] + '*');
          //db.cache.delete(a[1] + '*').then(function() {
          //	fetch(a[1] + '*');
          //});
          //var today = new Date().toISOString().substr(0,10);

          //$scope.invalidate(a[1]);
          $scope.render();
          fetchTx();
          fetchBalance();

          var wallet = getWalletByTx(a[1], CryptoJS.SHA256($scope.user));
          if (wallet && wallet.hasSound && wallet.hasSound !== $scope.defaultSound) {
            $scope.audioAlt = ngAudio.load(wallet.hasSound);
            $scope.audioAlt.play();
          } else {
            $scope.audio.play();
          }


          Notification.requestPermission(function (permission) {
            // If the user is okay, let's create a notification
            if (permission === "granted") {
              notify = true;
            }
          });
        };

      } else {
        socket = $scope.sockets[$scope.subs.indexOf(wss)];
      }



      subs.push(sub);
      setTimeout(function(){
        sendSub('sub ' + sub, socket);
      }, 1000);


    }
  }


  function getWalletByTx(ldpc, hash) {
    for (var i=0; i<$scope.wallets.length; i++) {
      if ($scope.wallets[i].trades + hash + '/' === ldpc) {
        return $scope.wallets[i];
      }
    }
  }

  // EVENTS
  //
  //
  $scope.validatePay = function() {

  };

  $scope.withdraw = function(wallet) {
    alert('not yet implemented on this wallet');
  };


  $scope.pay = function(id) {
    var source = $scope.user;
    if (!$scope.selects.friend || !$scope.selects.friend.id) alert ('destination is required');
    var destination = $scope.selects.friend.id;
    var amount = $scope.selects.amount;

    var err = '';

    if(!amount) err +=('Please enter an amount\n');

    if (isNaN(amount)) err += ('Amount must be a number');
    amount = parseFloat(amount);

    if(err !== '') {
      alert(err);
      return false;
    }


    var wc = '<>  a <https://w3id.org/cc#Credit> ;\n';
    wc += '  <https://w3id.org/cc#source> \n    <' + source + '> ;\n';
    wc += '  <https://w3id.org/cc#destination> \n    <' + destination + '> ;\n';
    wc += '  <https://w3id.org/cc#amount> "' + amount + '" ;\n';
    wc += '  <https://w3id.org/cc#currency> \n    <https://w3id.org/cc#bit> .\n';

    var hash = CryptoJS.SHA256(source).toString();

    function postFile(file, data) {
      xhr = new XMLHttpRequest();
      xhr.open('POST', file, false);
      xhr.setRequestHeader('Content-Type', 'text/turtle; charset=UTF-8');
      xhr.send(data);
    }

    //postFile( + hash + '/', wc);
    console.log(wc);

    $scope.openDialog('pay');

  };


  $scope.sendPayment = function() {
    var source = $scope.user;
    var destination = $scope.selects.friend.id;
    var amount = $scope.selects.amount;

    var err = '';

    if(!amount) err +=('Please enter an amount\n');

    if (isNaN(amount)) err += ('Amount must be a number');
    amount = parseFloat(amount);

    if(err !== '') {
      alert(err);
      return false;
    }


    var wc = '<#this>  a <https://w3id.org/cc#Credit> ;\n';
    wc += '  <https://w3id.org/cc#source> \n    <' + source + '> ;\n';
    wc += '  <https://w3id.org/cc#destination> \n    <' + destination + '> ;\n';
    wc += '  <https://w3id.org/cc#amount> "' + amount + '" ;\n';
    wc += '  <https://w3id.org/cc#currency> \n    <https://w3id.org/cc#bit> .\n';

    var hash = CryptoJS.SHA256(source).toString();

    function postFile(file, data) {
      xhr = new XMLHttpRequest();
      xhr.open('POST', file, false);
      xhr.setRequestHeader('Content-Type', 'text/turtle; charset=UTF-8');
      xhr.send(data);
    }

    //postFile( + hash + '/', wc);
    console.log(wc);

    var tx = $scope.wallet;

    var wallet = getById($scope.wallets, $scope.wallet);

    console.log(wallet);

    postFile(wallet.inbox + hash + '/', wc);


  };


  // main
  //
  //
  $scope.initApp();

});

// escape uris
App.filter('escape', function() {
  return window.encodeURIComponent;
});
