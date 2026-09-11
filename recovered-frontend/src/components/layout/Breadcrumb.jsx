import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../AppIcon';

const Breadcrumb = ({ items = [] }) => {
  const navigate = useNavigate();

  if (!items || items?.length === 0) {
    return null;
  }

  const handleClick = (path) => {
    if (path) {
      navigate(path);
    }
  };

  return (
    <nav className="breadcrumb-container" aria-label="Breadcrumb">
      <ol className="flex items-center gap-2">
        {items?.map((item, index) => {
          const isLast = index === items?.length - 1;
          
          return (
            <li key={index} className="breadcrumb-item">
              {!isLast && item?.path ? (
                <>
                  <button
                    onClick={() => handleClick(item?.path)}
                    className="breadcrumb-link"
                    aria-label={`Navigate to ${item?.label}`}
                  >
                    {item?.label}
                  </button>
                  <Icon 
                    name="ChevronRight" 
                    size={14} 
                    className="breadcrumb-separator" 
                  />
                </>
              ) : (
                <span className="breadcrumb-current" aria-current="page">
                  {item?.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;