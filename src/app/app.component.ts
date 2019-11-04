import { Component } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection, AngularFirestoreDocument } from '@angular/fire/firestore';
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFireStorage, AngularFireStorageReference, AngularFireUploadTask } from '@angular/fire/storage';
import {formatDate} from '@angular/common';
import { Observable } from 'rxjs';
import { ZXingScannerComponent } from '@zxing/ngx-scanner';
import { ViewChild } from '@angular/core';
import { map } from 'rxjs/operators';
import { ConnectionService } from 'ng-connection-service';

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
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  catchesCol: AngularFirestoreCollection<Catch>;
  catches: Observable<Catch[]>;
  chasersDoc: AngularFirestoreDocument<Chaser>;
  chasers: Observable<Chaser>;
  chasersListCol: AngularFirestoreCollection<Chaser>;
  chasersList: Observable<Chaser[]>;
  chaserID: string;
  chaserName: string;
  currentLocation: string;

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

  manualRunnerID: String;
  public imagePath;
  imgURL: any;

  ref: AngularFireStorageReference;
  task: AngularFireUploadTask;

  availableDevices: MediaDeviceInfo[];
  currentDevice: MediaDeviceInfo = null;
  hasDevices: boolean;
  hasPermission: boolean;

  uploadProgress: Observable<number>;

  isConnected = true;
  onlineStatus = 'ONLINE';

  catchesPending = false;


  @ViewChild('scanner', {static: false})
  scanner: ZXingScannerComponent;


  constructor(private afStorage: AngularFireStorage, private afs: AngularFirestore, public afAuth: AngularFireAuth, private connectionService: ConnectionService) {

    this.connectionService.monitor().subscribe(isConnected => {
      this.isConnected = isConnected;
      if (this.isConnected) {
        this.onlineStatus = 'ONLINE';
        setTimeout(() => this.updateFirestoreFromLocal(), 5000);
        console.log('Back online, updating catches...');
      } else {
        this.onlineStatus = 'OFFLINE';
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
      console.log('UPDATING LOCAL FROM FIREBASE BECAUSE SNAPSHOT CHANGE!');
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
        });
  }

  logout() {
    localStorage.removeItem('localChaserEmail');
    localStorage.removeItem('localCatches');
    this.afAuth.auth.signOut();
    location.reload();
  }

  ngOnInit() {
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

  onCodeResult(resultString: string) {
    this.addCatch(resultString, 'scan');

  }

  addCatch(runnerID: string, catchMethod: string) {

    this.qrResultString = runnerID;
    let currentTime = formatDate(new Date(), 'HH:mm', 'en');
    let currentLocation: string;
    let catchID = currentTime + '-' + this.chaserID + '-' + runnerID;

    let newCatchData = {catchID: catchID, runnerID: runnerID, time: currentTime, chaserID: this.chaserID, status: 'pending', runnerName: 'Catch Pending...', method: catchMethod};

    console.log(newCatchData);


    let tempLocalCatches = JSON.parse(localStorage.getItem('localCatches')); // Parse JSON
    console.log('Offline catch JSON: ' + JSON.stringify(tempLocalCatches));
    if (tempLocalCatches != null) {
      if (localStorage.getItem('localCatches').includes(catchID)) {
        console.log('Catch is already here!');
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
                  // TODO: Show catch added, then dissapear after 5 secs
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
    console.log('Saving to local device');
    localStorage.setItem('localCatches', JSON.stringify(localCatchArray));
    this.localCatches = JSON.parse(localStorage.getItem('localCatches'));



  }

  showScanner() {
    this.catchesVisible = false;
    this.scannerVisible = true;
  }

  resetCode() {
    this.qrResultString = '';
  }

  cancelCatch() {
    this.scannerVisible = false;
    this.catchesVisible = true;
    this.scanner.enable = false;
  }

  alertString(alerts: string) {
    alert(alerts);
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
    this.scannerVisible = false;
    this.addManuallyVisible = false;
    this.catchAddedVisible = true;
  }

  showAddPhoto(runnerInput: string) {
    this.addManuallyVisible = false;
    this.takePhotoVisible = true;

    this.manualRunnerID = runnerInput;
  }

  imageChosen(files) {

    let reader = new FileReader();
    this.imagePath = files;
    reader.readAsDataURL(files[0]);
    reader.onload = (_event) => {
      this.imgURL = reader.result;
    };

    let runnerID = 'trt' + this.manualRunnerID;

    let catchID = this.addCatch(runnerID, 'manual');

    if (catchID) {
      console.log('Uploading image as ' + catchID);
      this.ref = this.afStorage.ref(catchID);
      this.task = this.ref.put(files[0]);
      this.uploadProgress = this.task.percentageChanges();
      this.takePhotoVisible = false;
    }

    // this.uploadingManualVisible = true;



  }



}
