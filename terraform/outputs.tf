output "public_ip" {
  description = "Public IP address of the FreeRTC server"
  value       = aws_eip.freertc.public_ip
}

output "ssh_command" {
  description = "SSH command to connect to the server"
  value       = "ssh -i <your-key.pem> ubuntu@${aws_eip.freertc.public_ip}"
}
