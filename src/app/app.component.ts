import {Component, ViewChild, ViewEncapsulation} from '@angular/core';
import {AngularFirestore, AngularFirestoreCollection, AngularFirestoreDocument} from '@angular/fire/firestore';
import {AngularFireAuth} from '@angular/fire/auth';
import {AngularFireStorage, AngularFireStorageReference, AngularFireUploadTask} from '@angular/fire/storage';
import {formatDate} from '@angular/common';
import {Observable} from 'rxjs';
import {ZXingScannerComponent} from '@zxing/ngx-scanner';
import {map} from 'rxjs/operators';
import {ConnectionService} from 'ng-connection-service';
import {Network} from '@ngx-pwa/offline';
import {LZStringService} from 'ng-lz-string';

interface Catch {
  catchID: string;
  time: string;
  runnerName: string;
  chaserID: string;
  chaserName: string;
  runnerID: string;
  method: string;
  status: string;
  location: string;

}

interface Chaser {
  id: string;
  teamName: string;
  email: string;
}



@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class AppComponent {

  catchesCol: AngularFirestoreCollection<Catch>;
  catches: Observable<Catch[]>;
  chasersDoc: AngularFirestoreDocument<Chaser>;
  chasers: Observable<Chaser>;
  chasersListCol: AngularFirestoreCollection<Chaser>;
  chasersList: Observable<Chaser[]>;
  chaserID: string;

  catchWatchCol: AngularFirestoreCollection<any>;
  catchWatch: any;

  localCatches;

  chooseChaserVisible = false;
  enterPasswordVisible = false;
  loginTempUsername = '';
  loginWaitVisible;

  catchesVisible = false;
  scannerVisible = false;
  qrResultString: string;
  addManuallyVisible = false;
  catchAddedVisible = false;
  takePhotoVisible = false;
  uploadingManualVisible = false;
  menuVisible = false;
  pleaseWaitVisible = false;

  manualRunnerID: String;
  public imagePath: String;
  imgURL: any;

  ref: AngularFireStorageReference;

  availableDevices: MediaDeviceInfo[];
  hasDevices: boolean;
  hasPermission: boolean;

  uploadProgress: Observable<number>;

  isConnected = true;

  online$ = this.network.onlineChanges;

  catchesPending = false;

  torchWorking = true;
  torchIsOn = false;


  @ViewChild('scanner', {static: false})
  scanner: ZXingScannerComponent;


  constructor(protected network: Network, private afStorage: AngularFireStorage, private afs: AngularFirestore, public afAuth: AngularFireAuth, private connectionService: ConnectionService, private lz: LZStringService) {

    this.connectionService.monitor().subscribe(isConnected => {
      this.isConnected = isConnected;
      if (this.isConnected) {
        setTimeout(() => this.updateFirestoreFromLocal(), 5000);
        console.log('Back online, updating catches...');
      } else {
        console.log('Offline!!');
      }
    });

    this.chasersListCol = this.afs.collection('chasers');
    this.chasersList = this.chasersListCol.valueChanges();

    this.catchWatchCol = this.afs.collection<any>('catches');
    this.catchWatch = this.catchWatchCol.snapshotChanges()
      .pipe(
        map(actions => actions.map(a => this.updateFirestoreFromLocal()))
      );

    this.afs.collection('chasers').valueChanges().subscribe(data => {
      console.log('UPDATING LOCAL FROM FIREBASE BECAUSE SNAPSHOT CHANGE! - ' + data);
      this.updateFirestoreFromLocal();
    });


    console.log('Local storage says:' + localStorage.getItem('localChaserEmail'));
    if (localStorage.getItem('localChaserEmail') == null) {
      console.log('Local is null...');
      this.afAuth.authState.subscribe(user => {
        if (user) {
          this.setTeam(user.email);
          this.chooseChaserVisible = false;
          this.enterPasswordVisible = false;
          localStorage.setItem('localChaserEmail', user.email);
          console.log('Logged in online');
          this.updateFirestoreFromLocal();

        } else {
          this.chooseChaserVisible = true;
          console.log('Not logged in');
        }
      });
    } else {
      this.setTeam(localStorage.getItem('localChaserEmail'));
      this.chooseChaserVisible = false;
      this.enterPasswordVisible = false;
      console.log('Logged in offline');
      this.updateFirestoreFromLocal();
    }
  }

  updateOnlineStatus(){
    console.log("CHECKING ONLINE STATUS");
    this.connectionService.monitor().subscribe(isConnected => {
      this.isConnected = isConnected;
      if (this.isConnected) {
        console.log('Back online, updating catches...');
        setTimeout(() => this.updateFirestoreFromLocal(), 5000);
      } else {
        console.log('Offline!!');
      }
    });
  }

  setTempUsername(username: string) {
    this.loginTempUsername = username;
    this.chooseChaserVisible = false;
    this.enterPasswordVisible = true;
  }

  backChooseUser() {
    this.enterPasswordVisible = false;
    this.chooseChaserVisible = true;
  }

  login(password: string) {
    return this.afAuth.auth.signInWithEmailAndPassword(this.loginTempUsername, password)
      .then((user) => {

        console.log(user.user.email);

      })
      .catch(error => {
          console.log(error);
          alert(error);
        });
  }

  logout() {
    localStorage.removeItem('localChaserEmail');
    localStorage.removeItem('localCatches');
    this.afAuth.auth.signOut();
    location.reload();
  }

  ngOnInit() {
    this.updateOnlineStatus();
  }


  setTeam(id: string) {
    this.catchesVisible = false;
    this.chaserID = id;

    this.catchesCol = this.afs.collection('catches', ref => ref.orderBy('time', 'desc').where('chaserID', '==', this.chaserID));
    this.catches = this.catchesCol.valueChanges();

    this.chasersDoc = this.afs.doc('chasers/' + this.chaserID);
    this.chasers = this.chasersDoc.valueChanges();

    this.catchesVisible = true;
  }

  onCamerasFound(devices: MediaDeviceInfo[]): void {
    this.availableDevices = devices;
    this.hasDevices = Boolean(devices && devices.length);
  }


  onHasPermission(has: boolean) {
    this.hasPermission = has;
  }

  torchOn(){
    if (this.torchIsOn) {
      this.scanner.torch = false;
      this.torchIsOn = false;
      console.log('Torch off');
    } else {
      this.scanner.torch = true;
      this.torchIsOn = true;
      console.log('Torch on');
    }
  }

  onCodeResult(resultString: string) {
    let firstPart = resultString.substr(0,4);
    let lastPart = Number(resultString.substr(3, 3));
    if (resultString.length == 6 && firstPart == "trt1" && lastPart > 100 && lastPart < 140) {
      this.scannerVisible = false;
      this.pleaseWaitVisible = true;
      this.getLocation(resultString, 'scan');
    } else {
      alert('Sorry, this doesn\'t look like a runner\'s card!');
    }


  }

  getLocation(runnerID: string, catchMethod: string){
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position)=>{
        const latLong = position.coords.latitude + ", " + position.coords.longitude;
        console.log("Location found: "+position.coords.latitude)

        return this.addCatch(runnerID, catchMethod, latLong);
      });
    } else {
      console.log("No support for geolocation")
      return this.addCatch(runnerID, catchMethod, "undefined");
    }
  }

  addCatch(runnerID: string, catchMethod: string, currentLocation: string) {

    this.qrResultString = runnerID;
    let currentTime = formatDate(new Date(), 'HH:mm', 'en');
    let catchID = currentTime + '-' + this.chaserID + '-' + runnerID;

    let newCatchData = {
      catchID: catchID,
      runnerID: runnerID,
      time: currentTime,
      chaserID: this.chaserID,
      status: 'pending',
      runnerName: 'Catch Pending...',
      method: catchMethod,
      currentLocation
    };

    console.log(newCatchData);


    let tempLocalCatches = JSON.parse(localStorage.getItem('localCatches')); // Parse JSON
    console.log('Offline catch JSON: ' + JSON.stringify(tempLocalCatches));
    if (tempLocalCatches != null) {
      if (localStorage.getItem('localCatches').includes(catchID)) {
        console.log('Catch is already here!');
        alert("Looks like you've just caught this team, you might have scanned it twice! Your catch is already saved.")
      } else {
        console.log('Local catches already initialized, pushing catch');
        tempLocalCatches.push(newCatchData);
        localStorage.setItem('localCatches', JSON.stringify(tempLocalCatches));
        console.log('New local storage is: ' + localStorage.getItem('localCatches'));

      }
    } else {
      console.log('First local catch, creating array and adding...');
      let newCatchArray = [newCatchData];
      localStorage.setItem('localCatches', JSON.stringify(newCatchArray));
      console.log('New local storage is: ' + localStorage.getItem('localCatches'));


    }

    if (catchMethod == "manual") {
      let tempLocalImages = JSON.parse(localStorage.getItem('localImages'));
      if (tempLocalImages != null){
        console.log("Image: array is not null, adding...")
        tempLocalImages.push({'name': catchID, 'image': this.imagePath});
        localStorage.setItem('localImages', JSON.stringify(tempLocalImages));
        console.log("Local storage is now: "+JSON.stringify(tempLocalImages))
      }
      else {
        console.log("Image: array is empty, creating...")
        let newImageArray = [{'name': catchID, 'image': this.imagePath}];
        localStorage.setItem('localImages', JSON.stringify(newImageArray));
        console.log("Local storage is now: "+JSON.stringify(newImageArray))
      }

    }



    // this.afs.collection('catches').doc(catchID).set(newCatchData);
    this.updateFirestoreFromLocal();
    this.showCatchAdded();

    return catchID;

  }

  updateFirestoreFromLocal() {

    this.loginWaitVisible = false;

    let localCatchArray = JSON.parse(localStorage.getItem('localCatches'));

    console.log('Updating the current local catch db: ' + JSON.stringify(localCatchArray));

    if (localCatchArray) {
      for (let i = 0; i < localCatchArray.length; i++) {
        console.log('Checking if ' + localCatchArray[i].catchID + ' is in firestore..., ');
        console.log(localCatchArray[i]);
        const tempCatchesCol = this.afs.collection('catches');
        console.log('i is ' + i);

        tempCatchesCol.doc(localCatchArray[i].catchID).ref.get().then(function(doc) {
          for (let j = 0; j < localCatchArray.length; j++) {
            if (doc.id == localCatchArray[j].catchID) {
              if (doc.exists) {
                console.log(doc.id + ' is in firestore, updating from firebase');
                localCatchArray[j] = doc.data();
                console.log(localCatchArray[j]);
                localStorage.setItem('localStorage', localCatchArray);

              } else {
                console.log(localCatchArray);
                tempCatchesCol.doc(doc.id).set(localCatchArray[j]);
                // TODO: Show catch added, then disappear after 5 secs
              }
            }
            console.log('Saving to local device');
            localStorage.setItem('localCatches', JSON.stringify(localCatchArray));
          }
        }).catch(function(error) {
            console.log('Error getting document:', error);
        });
      }
    } else {
      console.log('No catches in local storage, attempt to get from firebase...');
      this.afs.collection('catches', ref => ref.where('chaserID', '==', this.chaserID)).ref.get().then(function(querySnapshot) {
        let tempLocalCatches = [];
        querySnapshot.forEach(function(doc) {
            // doc.data() is never undefined for query doc snapshots
            console.log(tempLocalCatches);

            console.log(doc.id, ' => ', doc.data());
            tempLocalCatches.push(doc.data());
            console.log('Saving to local device');
            localStorage.setItem('localCatches', JSON.stringify(localCatchArray));

        });

      })
      .catch(function(error) {
          console.log('Error getting documents: ', error);
      });
    }

    let tempLocalImages = JSON.parse(localStorage.getItem('localImages'));
    console.log("Just got the images:"+tempLocalImages);

    if (tempLocalImages != "" && tempLocalImages != null) {
      for (let i = 0; i < tempLocalImages.length; i++) {
        console.log("Uploading image for catch:" + tempLocalImages[i].name);
        this.ref = this.afStorage.ref(tempLocalImages[i].name);
        const decompressed = this.lz.decompress(tempLocalImages[i].image);
        console.log("Decompressed image!")
        this.ref.putString(decompressed, 'base64', {contentType: 'image/jpeg'}).then(function(snapshot) {
          console.log("Image has been uploaded successfully");
          console.log(tempLocalImages.shift()+" was shifted.");
          localStorage.setItem('localImages', JSON.stringify(tempLocalImages));
        });
      }
    }
    else {
      console.log("image storage empty")
    }




    console.log('Saving to local device');
    localStorage.setItem('localCatches', JSON.stringify(localCatchArray));
    this.localCatches = JSON.parse(localStorage.getItem('localCatches'));



  }

  showScanner() {
    this.catchesVisible = false;
    this.scannerVisible = true;
  }

  cancelCatch() {
    this.scannerVisible = false;
    this.catchesVisible = true;
    this.scanner.enable = false;
  }

  showAddManually() {
    this.scannerVisible = false;
    this.addManuallyVisible = true;
    this.scanner.enable = false;
  }

  backToScanner() {
    this.addManuallyVisible = false;
    this.takePhotoVisible = false;
    this.scannerVisible = true;
    this.imgURL = false;
  }

  backToCatches() {
    console.log('running');
    this.catchAddedVisible = false;
    this.catchesVisible = true;
  }

  showCatchAdded() {
    this.pleaseWaitVisible = false;
    this.addManuallyVisible = false;
    this.catchAddedVisible = true;
  }

  showAddPhoto(runnerInput: string) {
    let runnerNumber = Number(runnerInput);
    console.log(runnerNumber);
    if (Number.isInteger(Number(runnerInput)) && Number(runnerInput) > 100 && Number(runnerInput) < 140){
      console.log("_/")
      this.addManuallyVisible = false;
      this.takePhotoVisible = true;
      this.manualRunnerID = runnerInput;
    }
    else {
      alert("Sorry, this doesn't look like a runner's ID!");
      console.log("x")
    }

  }

  imageChosen(files) {

    this.takePhotoVisible = false;
    this.pleaseWaitVisible = true;

    let reader = new FileReader();
    reader.onload = this._handleReaderLoaded.bind(this);
    reader.readAsBinaryString(files[0]);

    console.log(this.imagePath);






    // this.uploadingManualVisible = true;
  }

  _handleReaderLoaded(readerEvt) {
    let binaryString = readerEvt.target.result;
    let btoaString = btoa(binaryString);
    console.log("Compressing and setting image...")
    this.imagePath = this.lz.compress(btoaString);
    let runnerID = 'trt' + this.manualRunnerID;
    this.getLocation(runnerID, "manual");
    console.log(btoa(binaryString));
  }




}
