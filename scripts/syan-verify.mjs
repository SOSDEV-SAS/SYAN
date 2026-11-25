import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const input = JSON.parse(readFileSync(0, 'utf8'));
const base = 'http://127.0.0.1:2283/api';
const jsonHeaders = { 'content-type': 'application/json' };
if (input.setup) {
  const signup = await fetch(`${base}/auth/admin-sign-up`, {method:'POST',headers:jsonHeaders,body:JSON.stringify(input.credentials)});
  assert.equal(signup.status,201,'Administrator bootstrap failed');
}
const login = await fetch(`${base}/auth/login`, {method:'POST',headers:jsonHeaders,body:JSON.stringify({email:input.credentials.email,password:input.credentials.password})});
assert.equal(login.status,201,'Administrator login failed');
const account = await login.json();
assert.ok(account.accessToken, 'Login did not return a session');
const headers = {'x-immich-user-token':account.accessToken};
const admin = await fetch(`${base}/android-releases`, {headers});
assert.equal(admin.status,200,'Administrator APK access failed');
const denied = await fetch(`${base}/android-releases`);
assert.equal(denied.status,401,'Anonymous admin access was not denied');
const published = await fetch(`${base}/android-releases/published`);
assert.equal(published.status,200,'Public APK metadata failed');
const bytes = readFileSync('/build/www/san-logo.png');
const form = new FormData();
form.set('fileCreatedAt',new Date().toISOString());
form.set('fileModifiedAt',new Date().toISOString());
form.set('assetData',new Blob([bytes],{type:'image/png'}),'san-deployment-check.png');
const upload = await fetch(`${base}/assets`,{method:'POST',headers,body:form});
assert.ok(upload.ok,`Upload failed: HTTP ${upload.status}`);
const asset = await upload.json();
assert.ok(asset.id,'Upload did not return an asset');
try {
 const download = await fetch(`${base}/assets/${asset.id}/original`,{headers});
 assert.equal(download.status,200,'Original download failed');
 const received=Buffer.from(await download.arrayBuffer());
 assert.equal(createHash('sha256').update(received).digest('hex'),createHash('sha256').update(bytes).digest('hex'),'Uploaded original changed');
} finally {
 if(asset.status !== 'duplicate') {
  const cleanup=await fetch(`${base}/assets`,{method:'DELETE',headers:{...headers,...jsonHeaders},body:JSON.stringify({ids:[asset.id],force:true})});
  assert.ok(cleanup.ok,'Test asset cleanup failed');
 }
}
console.log('PASS: administrator login, APK authorization, public metadata, upload/download checksum and test cleanup');