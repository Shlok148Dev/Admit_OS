resource "google_container_cluster" "gke_autopilot_cluster" {
  name     = "${var.cluster_name}-${var.environment}"
  location = var.region

  # Enable Autopilot
  enable_autopilot = true

  network    = google_compute_network.vpc_network.id
  subnetwork = google_compute_subnetwork.subnet.id

  # VPC-native settings using secondary subnet ranges
  ip_allocation_policy {
    cluster_secondary_range_name  = "admitos-pods-range"
    services_secondary_range_name = "admitos-services-range"
  }

  # Make it a private cluster with public master endpoint enabled for developer convenience (restricted via firewall or master authorized networks in production)
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  release_channel {
    channel = "REGULAR"
  }

  # Enable workload identity for secure service-to-service auth and GCP resource access
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Ensure the cluster has logging and monitoring enabled by default
  logging_service    = "logging.googleapis.com/kubernetes"
  monitoring_service = "monitoring.googleapis.com/kubernetes"
}
