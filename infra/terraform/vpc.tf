resource "google_compute_network" "vpc_network" {
  name                    = "${var.vpc_name}-${var.environment}"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name                     = "${var.subnet_name}-${var.environment}"
  ip_cidr_range            = "10.0.0.0/20"
  region                   = var.region
  network                  = google_compute_network.vpc_network.id
  private_ip_google_access = true

  secondary_ip_range {
    range_name    = "admitos-pods-range"
    ip_cidr_range = "10.48.0.0/14"
  }

  secondary_ip_range {
    range_name    = "admitos-services-range"
    ip_cidr_range = "10.52.0.0/20"
  }
}

resource "google_compute_router" "router" {
  name    = "admitos-router-${var.environment}"
  region  = var.region
  network = google_compute_network.vpc_network.id
}

resource "google_compute_router_nat" "nat" {
  name                               = "admitos-nat-${var.environment}"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"

  subnetwork {
    name                    = google_compute_subnetwork.subnet.id
    source_ip_ranges_to_nat = ["PRIMARY_IP_RANGE", "LIST_OF_SECONDARY_IP_RANGES"]
    secondary_ip_range_names = [
      "admitos-pods-range",
      "admitos-services-range"
    ]
  }
}
