import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Share } from "react-native";
import OnboardingScreen from "../../app/onboarding";
import HomeScreen from "../../app/index";
import RankRadarScreen from "../../app/rank-radar";
import MobileCounselingCompassScreen from "../../app/counsel";
import ShareableCard from "../components/ShareableCard";
import NotificationSettings from "../components/NotificationSettings";
import { storage } from "../lib/storage";
import { submitFeedback, predictCollegesMobile } from "../lib/api";

// 1. Setup Mock Implementations
const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
  }),
}));

jest.mock("../lib/storage", () => {
  const store: Record<string, string> = {};
  return {
    storage: {
      set: jest.fn((key, val) => {
        store[key] = String(val);
      }),
      getString: jest.fn((key) => store[key] || null),
    },
    getSavedColleges: jest.fn(() => []),
    saveCollege: jest.fn(() => []),
    removeSavedCollege: jest.fn(() => []),
  };
});

jest.mock("react-native-view-shot", () => ({
  captureRef: jest.fn().mockResolvedValue("mock-uri"),
}));

jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn().mockResolvedValue({ uri: "mock-manipulated-uri" }),
}));

const mockMutate = jest.fn();
jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: jest.fn(),
    useMutation: jest.fn(() => ({
      mutate: mockMutate,
      isPending: false,
      isSuccess: false,
    })),
    useQueryClient: jest.fn(() => ({
      setQueryData: jest.fn(),
    })),
  };
});

jest.mock("../lib/api", () => ({
  predictCollegesMobile: jest.fn(),
  getUpcomingEvents: jest.fn(),
  getNotifications: jest.fn(),
  submitFeedback: jest.fn(),
  getNotificationPreferences: jest.fn().mockResolvedValue({
    channels: { push: true, email: false, sms: false },
    categories: { updates: true, deadlines: true, results: false, system: true }
  }),
  saveNotificationPreferences: jest.fn().mockResolvedValue(true)
}));

// Spies
const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: Share.sharedAction });

describe("ADMIT OS Mobile Onboarding and Beta UX Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: Onboarding page navigation
  test("1. Onboarding progression through Screens 1 to 4 and profile persistence", async () => {
    (predictCollegesMobile as jest.Mock).mockResolvedValue({
      predictions: [
        {
          college_code: "NIT_TRICHY",
          college_name: "NIT Trichy",
          branch_code: "CS",
          branch_name: "Computer Science",
          admission_probability: 0.95,
          nirf_rank: 8,
          fees_per_year: 140000,
          quota: "OS",
          data_confidence: "HIGH"
        }
      ]
    });

    const { getByText, getByPlaceholderText } = render(<OnboardingScreen />);

    // Screen 1: Target Exam
    expect(getByText("Select your exam")).toBeTruthy();
    const ctetExamButton = getByText("MHT-CET (State)");
    fireEvent.press(ctetExamButton);
    fireEvent.press(getByText("Continue"));

    // Screen 2: Rank & Credentials
    expect(getByText("Your results")).toBeTruthy();
    const rankInput = getByPlaceholderText("Enter rank, e.g. 8500");
    fireEvent.changeText(rankInput, "12000");
    
    // Select OBC category
    fireEvent.press(getByText("OBC-NCL"));
    fireEvent.press(getByText("Continue"));

    // Screen 3: Home State & Predictions
    expect(getByText("Home State Quota")).toBeTruthy();
    // Verify predicted college highlight appeared
    await waitFor(() => {
      expect(getByText("NIT Trichy")).toBeTruthy();
    });
    
    fireEvent.press(getByText("Continue"));

    // Screen 4: Priorities & Launch
    expect(getByText("Set Priorities")).toBeTruthy();
    expect(getByText("Launch ADMIT OS")).toBeTruthy();

    fireEvent.press(getByText("Launch ADMIT OS"));

    // Check storage sets
    expect(storage.set).toHaveBeenCalledWith("has_onboarded_v1", "true");
    expect(storage.set).toHaveBeenCalledWith(
      "student_profile_v1",
      expect.stringContaining('"primary_exam":"MHT_CET"')
    );
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  // Test 2: Value card displays
  test("2. Home dashboard renders milestones countdown card and prediction highlights", async () => {
    // Setup stored profile so we bypass redirection
    (storage.getString as jest.Mock).mockImplementation((key) => {
      if (key === "has_onboarded_v1") return "true";
      if (key === "student_profile_v1") {
        return JSON.stringify({
          primary_exam: "JEE_MAIN",
          rank: 15000,
          category: "GENERAL",
          home_state: "MH",
          gender: "M"
        });
      }
      return null;
    });

    const mockEvents = [
      { id: "e1", exam: "JEE_MAIN", title: "JoSAA Choice Filling Begins", date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() }
    ];
    const mockNotifications = [
      { id: "n1", title: "JoSAA Round 1 seat allocation schedule declared" }
    ];
    const mockPredictions = {
      predictions: [
        {
          college_code: "IIT_B",
          college_name: "IIT Bombay",
          branch_code: "EE",
          branch_name: "Electrical Engineering",
          admission_probability: 0.88,
          nirf_rank: 3,
          fees_per_year: 220000,
          quota: "HS",
          data_confidence: "HIGH"
        }
      ]
    };

    const { useQuery } = require("@tanstack/react-query");
    (useQuery as jest.Mock).mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "upcomingEvents") return { data: mockEvents };
      if (queryKey[0] === "notifications") return { data: mockNotifications };
      if (queryKey[0] === "homePredictions") return { data: mockPredictions, isLoading: false };
      return { data: null };
    });

    const { getByText, getAllByText } = render(<HomeScreen />);

    // Check What's New alert pill
    expect(getByText("JoSAA Round 1 seat allocation schedule declared")).toBeTruthy();

    // Check Countdown milestone card details
    expect(getByText("NEXT MILESTONE ALERT")).toBeTruthy();
    expect(getAllByText("JoSAA Choice Filling Begins")[0]).toBeTruthy();
    expect(getByText("5")).toBeTruthy(); // 5 days left

    // Check Prediction highlights list
    expect(getAllByText("IIT Bombay")[0]).toBeTruthy();
    expect(getAllByText("Electrical Engineering")[0]).toBeTruthy();
    expect(getAllByText("88% Match")[0]).toBeTruthy();
  });

  // Test 3: Empty states
  test("3. Rank Radar and Counseling Compass render step-by-step empty state instructions", () => {
    // 3a. Rank Radar
    const { getByText: getRadarText } = render(<RankRadarScreen />);
    expect(getRadarText("How to use Rank Radar")).toBeTruthy();
    expect(getRadarText("Enter Scores & Caste Tags")).toBeTruthy();
    expect(getRadarText("Save to Offline Wishlist")).toBeTruthy();

    // 3b. Counseling Compass
    const { getByText: getCounselText } = render(<MobileCounselingCompassScreen />);
    expect(getCounselText("How Counseling Compass Works")).toBeTruthy();
    expect(getCounselText("Set Priority Weights")).toBeTruthy();
    expect(getCounselText("Run What-If Simulations")).toBeTruthy();
  });

  // Test 4: Shareable Card
  test("4. Shareable Spotify Wrapped card calls native share action", async () => {
    const { getByText } = render(
      <ShareableCard
        collegeName="NIT Trichy"
        branchName="Computer Science"
        probability={0.92}
        rank={4500}
        exam="JEE_MAIN"
        category="GENERAL"
      />
    );

    expect(getByText("ADMIT OS WRAPPED")).toBeTruthy();
    expect(getByText("92%")).toBeTruthy();

    const shareButton = getByText("Share Match to Spotify Wrapped");
    fireEvent.press(shareButton);

    await waitFor(() => {
      expect(shareSpy).toHaveBeenCalled();
    });
  });

  // Test 5: Feedback settings submission
  test("5. Settings feedback form submits input parameters to API", async () => {
    (submitFeedback as jest.Mock).mockResolvedValue(true);

    const mockPrefs = {
      channels: { push: true, email: false, whatsapp: false, sms: false },
      categories: { allotments: true, deadlines: true, alerts: false, system: true }
    };
    const { useQuery } = require("@tanstack/react-query");
    (useQuery as jest.Mock).mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "notificationPreferences") {
        return {
          data: mockPrefs,
          isLoading: false
        };
      }
      return { data: null };
    });

    const { getByText, getByPlaceholderText } = render(<NotificationSettings />);

    // Select category BUG
    fireEvent.press(getByText("BUG"));

    const messageInput = getByPlaceholderText("Tell us what we can improve, which college cutoffs look inaccurate, or suggest a new feature...");
    fireEvent.changeText(messageInput, "Found inaccuracy in MHT-CET computer science cutoffs.");

    const submitButton = getByText("Submit Suggestion");
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(submitFeedback).toHaveBeenCalledWith({
        category: "BUG",
        message: "Found inaccuracy in MHT-CET computer science cutoffs."
      });
      expect(getByText("✓ Thank you! Feedback submitted successfully.")).toBeTruthy();
    });
  });
});
