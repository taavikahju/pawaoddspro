// Mock implementation of next-themes
// This provides just enough implementation to allow the build to complete

export const ThemeProvider = ({ children }) => children;

export const useTheme = () => {
  return {
    theme: "light",
    setTheme: (theme) => console.log('Theme would change to:', theme),
    themes: ["light", "dark"]
  };
};