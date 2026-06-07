variable "project_id" {
  description = "The Google Cloud Project ID"
  type        = string
}

variable "region" {
  description = "The GCP region to deploy resources in"
  type        = string
  default     = "asia-south1"
}

variable "environment" {
  description = "Deployment environment (e.g., dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "cluster_name" {
  description = "The name of the GKE Autopilot cluster"
  type        = string
  default     = "admitos-gke-cluster"
}

variable "vpc_name" {
  description = "The name of the VPC network"
  type        = string
  default     = "admitos-vpc"
}

variable "subnet_name" {
  description = "The name of the subnetwork"
  type        = string
  default     = "admitos-subnet-mumbai"
}
