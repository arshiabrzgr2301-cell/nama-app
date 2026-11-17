export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Dashboard: undefined;
  AddProperty: { latitude?: number; longitude?: number } | undefined;
  MapPicker: { latitude?: number; longitude?: number } | undefined;
  PropertyDetail: { id: string };
  TourViewer: { id: string; panoramaUrl?: string };
  VRMode: { id: string; panoramaUrl?: string };
  ScanGuide: undefined;
  Activity: undefined;
  Reminders: undefined;
  Team: undefined;
};
