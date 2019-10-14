import { Component } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection, AngularFirestoreDocument } from '@angular/fire/firestore';
import { AngularFireAuth } from '@angular/fire/auth';
import { auth } from 'firebase/app';
import * as firebase from 'firebase/app';
import {formatDate} from '@angular/common';
import { Observable } from 'rxjs';
import { ZXingScannerComponent } from '@zxing/ngx-scanner';
import { ViewChild } from '@angular/core';

interface Catch {
  time: string;
  runnerName: string;
  chaserID: string;
  chaserName: string;
  runnerID: string;
}

interface Chaser {
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
  chaserID: string;
  chaserName: string;
  currentLocation: string;
  
  catchesVisible = false;
  scannerVisible = false;
  qrResultString: string;

  availableDevices: MediaDeviceInfo[];
  currentDevice: MediaDeviceInfo = null;
  hasDevices: boolean;
  hasPermission: boolean;

  @ViewChild('scanner', {static: false}) 
  scanner: ZXingScannerComponent;


  constructor(private afs: AngularFirestore, public afAuth: AngularFireAuth) {
    this.afAuth.authState.subscribe(user => {
      if (user) {
        this.setTeam(user.email);

      } else {
        alert("Not logged in");
      }
    })
  }
  

  login(username: string, password: string) {
    return this.afAuth.auth.signInWithEmailAndPassword(username, password)
      .then((user) => {
        console.log(user.user.email)
        
      })
      .catch(error => console.log(error));
  }

  logout() {
    this.afAuth.auth.signOut();
  }

  ngOnInit() {
  }


  setTeam(id:string) {
    this.catchesVisible = false;
    this.chaserID = id;

    this.catchesCol = this.afs.collection('catches', ref => ref.orderBy('time', 'desc').where('chaserID', '==', this.chaserID));
    this.catches = this.catchesCol.valueChanges();

    this.chasersDoc = this.afs.doc('chasers/'+this.chaserID);
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
    this.qrResultString = resultString;
    var currentTime = formatDate(new Date(), 'HH:mm', 'en');
    var currentLocation: string;    
    this.afs.collection('catches').add({'runnerID': resultString, 'time': currentTime, 'chaserID': this.chaserID, 'status': 'pending', 'runnerName': 'Catch Pending...'});
    this.scannerVisible = false;
    this.catchesVisible = true;
  }

  showScanner(){
    this.catchesVisible = false;
    this.scannerVisible = true;
  }

  resetCode(){
    this.qrResultString = "";
  }

  cancelCatch(){
    this.scannerVisible = false;
    this.catchesVisible = true;
    this.scanner.enable = false;
  }
}
