import { createTheme } from '@mui/material/styles';
import type {} from '@mui/x-date-pickers/themeAugmentation';

export const muiTheme = createTheme({
  typography: {
    fontFamily: '"Exo 2", system-ui, -apple-system, sans-serif',
  },
  palette: {
    primary: {
      main: '#002855', // Corporate blue
    },
  },
  components: {
    MuiPickerDay: {
      styleOverrides: {
        root: {
          fontSize: '13px',
          fontWeight: 600,
          '&.Mui-selected': {
            backgroundColor: '#002855',
            '&:hover': {
              backgroundColor: '#001a36',
            }
          }
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: '0.5rem',
          backgroundColor: '#f8fafc',
          '& fieldset': {
            borderColor: '#e2e8f0',
          },
          '&:hover fieldset': {
            borderColor: '#cbd5e1',
          },
          '&.Mui-focused fieldset': {
            borderColor: '#3b82f6',
            borderWidth: '1px',
          },
        },
        input: {
          padding: '10.5px 14px',
          fontSize: '13px',
          fontWeight: 600,
          color: '#334155',
          height: '1.25em',
        }
      }
    }
  }
});
