output "cluster_name" {
  description = "The name of the GKE Autopilot cluster"
  value       = google_container_cluster.gke_autopilot_cluster.name
}

output "cluster_endpoint" {
  description = "The IP address of the GKE cluster master endpoint"
  value       = google_container_cluster.gke_autopilot_cluster.endpoint
}

output "cluster_ca_certificate" {
  description = "The public certificate of the GKE cluster master"
  value       = google_container_cluster.gke_autopilot_cluster.master_auth[0].cluster_ca_certificate
  sensitive   = true
}

output "vpc_network_id" {
  description = "The ID of the created VPC network"
  value       = google_compute_network.vpc_network.id
}

output "subnet_id" {
  description = "The ID of the created subnetwork"
  value       = google_compute_subnetwork.subnet.id
}
