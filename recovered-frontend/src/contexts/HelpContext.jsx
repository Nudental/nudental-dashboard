import React, { createContext, useContext, useState } from "react";

const HelpContext = createContext({ helpOpen: false, setHelpOpen: () => {} });

export const HelpProvider = ({ children }) => {
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <HelpContext.Provider value={{ helpOpen, setHelpOpen }}>
      {children}
    </HelpContext.Provider>
  );
};

export const useHelp = () => useContext(HelpContext);

export default HelpContext;
