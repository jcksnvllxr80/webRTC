# WebRTC

A little WebRTC sample project with hosted https server

## getting started

* generate some certs for https in the root directory  
`openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout private.key -out certificate.pem`  

* start the server with `node server.js`. Note the server's ip  

* use `https://<server_ip>:3000` from browsers on other computers

inspired by:

* https://medium.com/agora-io/how-does-webrtc-work-996748603141
